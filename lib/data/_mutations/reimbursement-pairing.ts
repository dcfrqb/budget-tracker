// ─────────────────────────────────────────────────────────────
// Reimbursement suggestion matcher + auto-linker
// Suggestions: suggest-only, no mutations.
// autoMatchReimbursements: mutates — creates CompensationGroups.
// ─────────────────────────────────────────────────────────────

import { TransactionKind, SharingType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { convertToBase, getLatestRatesMap } from "@/lib/data/wallet";
import { getPrimaryCurrency } from "@/lib/data/settings";
import { normalizeMerchant } from "@/lib/integrations/merchant";
import { pickMainAndNetto } from "@/lib/data/_shared/compensation-projection";

// ─── Constants ────────────────────────────────────────────────

const LOOKBACK_DAYS = 60;
/** Suggest tier: income within ~5% of spend amount */
const SUGGEST_TOLERANCE = 0.05;
/** Auto tier: income within 2% of spend amount — tight gate for exact-amount reimbursers */
const AUTO_TOLERANCE = 0.02;
/** How far BEFORE a spend the reimbursement may arrive (days) */
const WINDOW_BEFORE_DAYS = 3;
/** How far AFTER a spend the reimbursement may arrive (days) */
const WINDOW_AFTER_DAYS = 30;
const DEFAULT_LOOKBACK_DAYS = 90;

// ─── Types ────────────────────────────────────────────────────

export type ReimbursementSuggestion = {
  subscription: {
    id: string;
    name: string;
    reimbursementExpected: string;
    reimbursementCurrency: string | null;
    reimbursementFrom: string | null;
  };
  income: {
    id: string;
    name: string;
    amount: string;
    currencyCode: string;
    occurredAt: Date;
  };
  spend: {
    id: string;
    amount: string;
    currencyCode: string;
    occurredAt: Date;
  } | null;
  reason: "amount_match" | "amount_and_name_match";
};

export type AutoMatchReimbursementsResult = {
  autoLinked: number;
  ambiguousSkipped: number;
};

// ─── Name token helper ────────────────────────────────────────

/**
 * Extracts the first significant word from a reimbursementFrom string for
 * loose name containment matching against income transaction names.
 * e.g. "Алексей С." → "алексей"
 */
function extractNameToken(reimbursementFrom: string): string {
  return reimbursementFrom.trim().toLowerCase().split(/\s+/)[0] ?? "";
}

// ─── Amount within tolerance ──────────────────────────────────

function amountWithinTolerance(
  incomeDec: Prisma.Decimal,
  incomeCcy: string,
  spendDec: Prisma.Decimal,
  spendCcy: string,
  rates: Map<string, Prisma.Decimal>,
  tolerance: number,
): boolean {
  const ref = spendDec.abs();
  const inc = incomeDec.abs();
  if (ref.isZero()) return inc.isZero();

  let incInSpendCcy: Prisma.Decimal;
  if (incomeCcy === spendCcy) {
    incInSpendCcy = inc;
  } else {
    const converted = convertToBase(inc, incomeCcy, spendCcy, rates);
    if (!converted) return false;
    incInSpendCcy = converted;
  }

  const ratio = incInSpendCcy.minus(ref).abs().div(ref);
  return ratio.lessThanOrEqualTo(new Prisma.Decimal(tolerance));
}

// ─── Core DB compensation creation (no server-action overhead) ─

async function linkSpendAndIncome(
  userId: string,
  spendId: string,
  incomeId: string,
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
): Promise<boolean> {
  // Fetch both legs with fields needed by pickMainAndNetto
  const txns = await db.transaction.findMany({
    where: { id: { in: [spendId, incomeId] }, userId, deletedAt: null },
    select: {
      id: true,
      kind: true,
      amount: true,
      currencyCode: true,
      categoryId: true,
      compensationGroupId: true,
      transferId: true,
    },
  });

  if (txns.length !== 2) return false;
  if (txns.some((t) => t.compensationGroupId !== null)) return false;
  if (txns.some((t) => t.transferId !== null)) return false;

  let mainResult: ReturnType<typeof pickMainAndNetto>;
  try {
    mainResult = pickMainAndNetto(txns, rates, baseCcy);
  } catch {
    return false;
  }

  const { mainTxnId, nettoBase, nettoSign, categoryIdForAggregation } = mainResult;

  const mainTxnFull = await db.transaction.findUnique({
    where: { id: mainTxnId },
    select: { occurredAt: true },
  });
  if (!mainTxnFull) return false;

  try {
    await db.$transaction(async (tx) => {
      // Re-validate inside the transaction: both must still be unclaimed
      const stillFree = await tx.transaction.findMany({
        where: {
          id: { in: [spendId, incomeId] },
          compensationGroupId: null,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (stillFree.length < 2) {
        // One or both were claimed between the outer fetch and this write — abort cleanly
        throw Object.assign(new Error("already_claimed"), { alreadyClaimed: true });
      }

      const created = await tx.compensationGroup.create({
        data: {
          userId,
          mainTxnId,
          nettoBase,
          nettoSign,
          baseCcy,
          categoryIdForAggregation: categoryIdForAggregation ?? null,
          occurredAt: mainTxnFull.occurredAt,
        },
      });
      await tx.transaction.updateMany({
        where: { id: { in: [spendId, incomeId] } },
        data: { compensationGroupId: created.id },
      });
    });
    return true;
  } catch (err) {
    // Clean abort (race condition) — not an error, just not linked
    if (err instanceof Error && (err as Error & { alreadyClaimed?: boolean }).alreadyClaimed) {
      return false;
    }
    return false;
  }
}

// ─── Auto-matcher ─────────────────────────────────────────────

/**
 * For each active PAID_FOR_OTHERS subscription with reimbursementFrom set,
 * loads un-reimbursed linked spends and attempts to find a matching INCOME
 * transaction by name token + tight amount gate (2%).
 *
 * If exactly one candidate matches → creates a CompensationGroup (auto-link).
 * If >1 candidate → skips (ambiguous; surfaced in UI by getReimbursementSuggestions).
 *
 * Idempotent: spends/incomes already in a compensation are excluded.
 * Default lookback: 90 days. Best-effort: errors are caught and logged.
 */
export async function autoMatchReimbursements(opts: {
  userId: string;
  windowFrom?: Date;
  windowTo?: Date;
}): Promise<AutoMatchReimbursementsResult> {
  try {
    const { userId } = opts;
    const windowTo = opts.windowTo ?? new Date();
    const windowFrom =
      opts.windowFrom ??
      new Date(windowTo.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    // Fetch active PAID_FOR_OTHERS subs with reimbursementFrom set
    const subs = await db.subscription.findMany({
      where: {
        userId,
        isActive: true,
        deletedAt: null,
        sharingType: SharingType.PAID_FOR_OTHERS,
        reimbursementFrom: { not: null },
      },
      select: {
        id: true,
        name: true,
        currencyCode: true,
        reimbursementFrom: true,
      },
    });

    if (subs.length === 0) return { autoLinked: 0, ambiguousSkipped: 0 };

    const [rates, baseCcy] = await Promise.all([
      getLatestRatesMap(),
      getPrimaryCurrency(userId),
    ]);

    // claimed: track txn ids used in this run to prevent double-pairing
    const claimed = new Set<string>();
    let autoLinked = 0;
    let ambiguousSkipped = 0;

    for (const sub of subs) {
      const nameToken = extractNameToken(sub.reimbursementFrom!);
      if (!nameToken) continue;

      // Un-reimbursed spends linked to this subscription within lookback window
      const spends = await db.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          kind: TransactionKind.EXPENSE,
          subscriptionId: sub.id,
          compensationGroupId: null,
          occurredAt: { gte: windowFrom, lte: windowTo },
        },
        select: {
          id: true,
          amount: true,
          currencyCode: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: "asc" },
      });

      if (spends.length === 0) continue;

      // Hoist candidate-income fetch to once per sub (not once per spend).
      // Use the broadest possible window covering all spends for this sub.
      const minSpendTime = spends.reduce(
        (min, s) => Math.min(min, s.occurredAt.getTime()),
        Infinity,
      );
      const maxSpendTime = spends.reduce(
        (max, s) => Math.max(max, s.occurredAt.getTime()),
        -Infinity,
      );
      const poolFrom = new Date(minSpendTime - WINDOW_BEFORE_DAYS * 24 * 60 * 60 * 1000);
      const poolTo = new Date(maxSpendTime + WINDOW_AFTER_DAYS * 24 * 60 * 60 * 1000);

      const incomePool = await db.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          kind: TransactionKind.INCOME,
          transferId: null,
          compensationGroupId: null,
          occurredAt: { gte: poolFrom, lte: poolTo },
          name: { contains: nameToken, mode: "insensitive" },
        },
        select: {
          id: true,
          amount: true,
          currencyCode: true,
          occurredAt: true,
          name: true,
        },
      });

      for (const spend of spends) {
        if (claimed.has(spend.id)) continue;

        const spendDec = new Prisma.Decimal(spend.amount).abs();
        const rangeFrom = new Date(
          spend.occurredAt.getTime() - WINDOW_BEFORE_DAYS * 24 * 60 * 60 * 1000,
        );
        const rangeTo = new Date(
          spend.occurredAt.getTime() + WINDOW_AFTER_DAYS * 24 * 60 * 60 * 1000,
        );

        // Filter the in-memory pool to per-spend date window + amount gate (2%)
        const matching = incomePool.filter(
          (inc) =>
            !claimed.has(inc.id) &&
            inc.occurredAt >= rangeFrom &&
            inc.occurredAt <= rangeTo &&
            amountWithinTolerance(
              new Prisma.Decimal(inc.amount),
              inc.currencyCode,
              spendDec,
              spend.currencyCode,
              rates,
              AUTO_TOLERANCE,
            ),
        );

        if (matching.length === 0) continue;

        if (matching.length > 1) {
          ambiguousSkipped++;
          continue;
        }

        // Exactly one match — auto-link
        const income = matching[0];
        const ok = await linkSpendAndIncome(userId, spend.id, income.id, rates, baseCcy);
        if (ok) {
          claimed.add(spend.id);
          claimed.add(income.id);
          autoLinked++;
        }
      }
    }

    console.log(
      `[reimbursement-pairing] done: autoLinked=${autoLinked} ambiguousSkipped=${ambiguousSkipped}`,
    );

    return { autoLinked, ambiguousSkipped };
  } catch (err) {
    console.error("[reimbursement-pairing] autoMatchReimbursements failed:", err);
    return { autoLinked: 0, ambiguousSkipped: 0 };
  }
}

// ─── Suggestion matcher ───────────────────────────────────────

/**
 * For each active PAID_FOR_OTHERS subscription with reimbursementFrom set,
 * scans INCOME transactions (within 60 days, unlinked) for:
 *   1. Per-spend amount matches (income ≈ a linked spend amount within ~5%)
 *   2. Fixed reimbursementExpected matches (fallback for configured fixed amounts)
 *
 * Returns serialized suggestions (all Decimals as strings). Suggest-only — no mutations.
 */
export async function getReimbursementSuggestions(
  userId: string,
): Promise<ReimbursementSuggestion[]> {
  try {
    const windowTo = new Date();
    const windowFrom = new Date(windowTo.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    // Fetch PAID_FOR_OTHERS subs with reimbursementFrom set
    const subs = await db.subscription.findMany({
      where: {
        userId,
        isActive: true,
        deletedAt: null,
        sharingType: SharingType.PAID_FOR_OTHERS,
        reimbursementFrom: { not: null },
      },
      select: {
        id: true,
        name: true,
        currencyCode: true,
        reimbursementExpected: true,
        reimbursementCurrency: true,
        reimbursementFrom: true,
      },
    });

    if (subs.length === 0) return [];

    // Fetch unlinked INCOME transactions in window
    const incomes = await db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        transferId: null,
        compensationGroupId: null,
        occurredAt: { gte: windowFrom, lte: windowTo },
      },
      select: {
        id: true,
        name: true,
        amount: true,
        currencyCode: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: "desc" },
    });

    if (incomes.length === 0) return [];

    const rates = await getLatestRatesMap();
    const suggestions: ReimbursementSuggestion[] = [];
    const seenIncomePairs = new Set<string>(); // incomeId:subId

    for (const sub of subs) {
      const fromKey = sub.reimbursementFrom
        ? normalizeMerchant(sub.reimbursementFrom)
        : null;
      const nameToken = sub.reimbursementFrom
        ? extractNameToken(sub.reimbursementFrom)
        : null;

      // Load all un-reimbursed spends for this sub within window
      const subSpends = await db.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          kind: TransactionKind.EXPENSE,
          subscriptionId: sub.id,
          compensationGroupId: null,
          occurredAt: { gte: windowFrom, lte: windowTo },
        },
        select: {
          id: true,
          amount: true,
          currencyCode: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: "desc" },
      });

      // Also keep the latest spend as fallback (for fixed-expected matching without per-spend match)
      const latestSpend = subSpends[0] ?? null;

      for (const income of incomes) {
        const pairKey = `${income.id}:${sub.id}`;
        if (seenIncomePairs.has(pairKey)) continue;

        const incomeAmount = new Prisma.Decimal(income.amount).abs();

        // Name match check
        let nameMatch = false;
        if (fromKey) {
          const incomeKey = normalizeMerchant(income.name);
          if (incomeKey && (incomeKey.includes(fromKey) || fromKey.includes(incomeKey))) {
            nameMatch = true;
          }
        } else if (nameToken) {
          nameMatch = income.name.toLowerCase().includes(nameToken);
        }

        // ── Tier A: per-spend amount match ────────────────────
        // Find the best matching spend for this income: amount within 5%, time window
        let matchedSpend: (typeof subSpends)[number] | null = null;
        for (const spend of subSpends) {
          const spendDec = new Prisma.Decimal(spend.amount).abs();
          const rangeFrom = new Date(
            spend.occurredAt.getTime() - WINDOW_BEFORE_DAYS * 24 * 60 * 60 * 1000,
          );
          const rangeTo = new Date(
            spend.occurredAt.getTime() + WINDOW_AFTER_DAYS * 24 * 60 * 60 * 1000,
          );

          const inWindow =
            income.occurredAt >= rangeFrom && income.occurredAt <= rangeTo;

          if (
            inWindow &&
            amountWithinTolerance(
              incomeAmount,
              income.currencyCode,
              spendDec,
              spend.currencyCode,
              rates,
              SUGGEST_TOLERANCE,
            )
          ) {
            matchedSpend = spend;
            break; // take the most recent match
          }
        }

        if (matchedSpend) {
          seenIncomePairs.add(pairKey);
          suggestions.push({
            subscription: {
              id: sub.id,
              name: sub.name,
              reimbursementExpected: sub.reimbursementExpected
                ? new Prisma.Decimal(sub.reimbursementExpected).toFixed(2)
                : new Prisma.Decimal(matchedSpend.amount).abs().toFixed(2),
              reimbursementCurrency: sub.reimbursementCurrency,
              reimbursementFrom: sub.reimbursementFrom,
            },
            income: {
              id: income.id,
              name: income.name,
              amount: incomeAmount.toFixed(2),
              currencyCode: income.currencyCode,
              occurredAt: income.occurredAt,
            },
            spend: {
              id: matchedSpend.id,
              amount: new Prisma.Decimal(matchedSpend.amount).abs().toFixed(2),
              currencyCode: matchedSpend.currencyCode,
              occurredAt: matchedSpend.occurredAt,
            },
            reason: nameMatch ? "amount_and_name_match" : "amount_match",
          });
          continue;
        }

        // ── Tier B: fixed reimbursementExpected fallback ──────
        if (!sub.reimbursementExpected) continue;

        const expected = new Prisma.Decimal(sub.reimbursementExpected);
        const expectedCcy = sub.reimbursementCurrency ?? sub.currencyCode;

        let amountOk = false;
        if (income.currencyCode === expectedCcy) {
          const diff = incomeAmount.minus(expected).abs();
          if (expected.isZero()) {
            amountOk = incomeAmount.isZero();
          } else {
            amountOk = diff
              .div(expected)
              .lessThanOrEqualTo(new Prisma.Decimal(SUGGEST_TOLERANCE));
          }
        } else {
          const incomeInExpectedCcy = convertToBase(
            incomeAmount,
            income.currencyCode,
            expectedCcy,
            rates,
          );
          if (incomeInExpectedCcy && !expected.isZero()) {
            amountOk = incomeInExpectedCcy
              .minus(expected)
              .abs()
              .div(expected)
              .lessThanOrEqualTo(new Prisma.Decimal(SUGGEST_TOLERANCE));
          }
        }

        if (!amountOk) continue;

        seenIncomePairs.add(pairKey);
        suggestions.push({
          subscription: {
            id: sub.id,
            name: sub.name,
            reimbursementExpected: expected.toFixed(2),
            reimbursementCurrency: sub.reimbursementCurrency,
            reimbursementFrom: sub.reimbursementFrom,
          },
          income: {
            id: income.id,
            name: income.name,
            amount: incomeAmount.toFixed(2),
            currencyCode: income.currencyCode,
            occurredAt: income.occurredAt,
          },
          spend: latestSpend
            ? {
                id: latestSpend.id,
                amount: new Prisma.Decimal(latestSpend.amount).abs().toFixed(2),
                currencyCode: latestSpend.currencyCode,
                occurredAt: latestSpend.occurredAt,
              }
            : null,
          reason: nameMatch ? "amount_and_name_match" : "amount_match",
        });
      }
    }

    return suggestions;
  } catch (err) {
    console.error("[getReimbursementSuggestions] failed:", err);
    return [];
  }
}
