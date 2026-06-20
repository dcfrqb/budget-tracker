// ─────────────────────────────────────────────────────────────
// Subscription auto-reconciliation
// ─────────────────────────────────────────────────────────────

import { TransactionKind, Prisma } from "@prisma/client";
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { convertToBase, getLatestRatesMap } from "@/lib/data/wallet";
import { normalizeMerchant, merchantSimilarity } from "@/lib/integrations/merchant";

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_LOOKBACK_DAYS = 90;
const DATE_WINDOW_DAYS = 5;
const DATE_WINDOW_DAYS_ANNUAL = 12;
const AMOUNT_TOLERANCE = 0.05;
const CROSS_CCY_FX_TOLERANCE = 0.10;
const SUGGESTION_SIMILARITY_THRESHOLD = 0.6;

// ─── Types ────────────────────────────────────────────────────

type CandidateTxn = {
  id: string;
  accountId: string;
  amount: Prisma.Decimal;
  currencyCode: string;
  occurredAt: Date;
  name: string;
  subscriptionId: string | null;
  subscriptionLinkSource: string | null;
};

type SubWithMatchInfo = Subscription & {
  normalizedName: string;
};

export type Suggestion = {
  transaction: {
    id: string;
    name: string;
    amount: string;
    currencyCode: string;
    occurredAt: Date;
    accountId: string;
  };
  subscription: {
    id: string;
    name: string;
    price: string;
    currencyCode: string;
    billingIntervalMonths: number;
    nextPaymentDate: Date;
    isVariablePrice: boolean;
  };
  reason: "alias_ambiguous" | "similarity" | "amount_date";
};

export type AutoMatchResult = {
  autoLinked: number;
  advanced: number;
  ambiguousSkipped: number;
  suggested: number;
};

// ─── Date window helper ────────────────────────────────────────

/**
 * Advance nextPaymentDate forward by billingIntervalMonths until strictly after paidAt.
 * Returns unchanged if currentNext is already after paidAt.
 * Max 60 iterations to prevent infinite loops.
 */
export function advanceNextPaymentDate(
  currentNext: Date,
  months: number,
  paidAt: Date,
): Date {
  if (currentNext > paidAt) return currentNext;

  let result = new Date(currentNext);
  let iterations = 0;

  while (result <= paidAt && iterations < 60) {
    const next = new Date(result);
    next.setMonth(next.getMonth() + months);
    result = next;
    iterations++;
  }

  return result;
}

// ─── Expected period boundaries ───────────────────────────────

/**
 * Generates expected payment dates stepping backward from nextPaymentDate by billingIntervalMonths.
 * Returns dates within [windowFrom, windowTo] plus neighbours for boundary cases.
 */
function getExpectedPaymentDates(
  sub: Subscription,
  windowFrom: Date,
  windowTo: Date,
): Date[] {
  const dates: Date[] = [];
  const months = sub.billingIntervalMonths;

  // Step backward from nextPaymentDate to cover the lookback window
  let cursor = new Date(sub.nextPaymentDate);
  let iterations = 0;

  while (cursor >= windowFrom && iterations < 200) {
    if (cursor <= windowTo) {
      dates.push(new Date(cursor));
    }
    const prev = new Date(cursor);
    prev.setMonth(prev.getMonth() - months);
    cursor = prev;
    iterations++;
  }
  // Include one more (just before windowFrom) for the boundary case
  dates.push(new Date(cursor));

  return dates;
}

// ─── Amount gate ───────────────────────────────────────────────

// Sign convention: EXPENSE Transaction.amount is stored as positive magnitude.
// Adapters use Math.abs() before persisting (see tinkoff-retail-playwright.ts:544,880).
// Therefore txnAmount passed here is always >= 0; no .abs() needed.
function amountInTolerance(
  txnAmount: Prisma.Decimal,
  txnCcy: string,
  subPrice: Prisma.Decimal,
  subCcy: string,
  rates: Map<string, Prisma.Decimal>,
): boolean {
  if (txnCcy === subCcy) {
    const diff = txnAmount.minus(subPrice).abs();
    if (subPrice.isZero()) return txnAmount.isZero();
    const ratio = diff.div(subPrice);
    return ratio.lessThanOrEqualTo(new Prisma.Decimal(AMOUNT_TOLERANCE));
  }

  // Cross-currency: convert both to a common base (sub's currency via rates)
  const txnInSubCcy = convertToBase(txnAmount, txnCcy, subCcy, rates);
  if (!txnInSubCcy) return false;

  const diff = txnInSubCcy.minus(subPrice).abs();
  if (subPrice.isZero()) return txnInSubCcy.isZero();
  const ratio = diff.div(subPrice);
  return ratio.lessThanOrEqualTo(new Prisma.Decimal(CROSS_CCY_FX_TOLERANCE));
}

// ─── Date window check ─────────────────────────────────────────

function txnWithinDateWindow(
  txnDate: Date,
  expectedDates: Date[],
  windowDays: number,
): boolean {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  for (const expected of expectedDates) {
    if (Math.abs(txnDate.getTime() - expected.getTime()) <= windowMs) {
      return true;
    }
  }
  // Backfill: accept if txn predates nextPaymentDate by a reasonable margin
  return false;
}

// ─── Alias-based look up ───────────────────────────────────────

function findMatchingSubsByAlias(
  txnKey: string,
  subs: SubWithMatchInfo[],
): SubWithMatchInfo[] {
  return subs.filter((sub) => {
    for (const alias of sub.matchKeywords) {
      const normalAlias = normalizeMerchant(alias);
      if (!normalAlias) continue;
      if (txnKey.includes(normalAlias) || normalAlias.includes(txnKey)) {
        return true;
      }
    }
    return false;
  });
}

// ─── Learn alias ───────────────────────────────────────────────

export async function learnAliasFromTransaction(
  tx: Prisma.TransactionClient,
  subId: string,
  merchantName: string,
): Promise<void> {
  const key = normalizeMerchant(merchantName);
  if (!key) return;

  const sub = await tx.subscription.findUnique({
    where: { id: subId },
    select: { matchKeywords: true },
  });
  if (!sub) return;

  if (!sub.matchKeywords.includes(key)) {
    await tx.subscription.update({
      where: { id: subId },
      data: { matchKeywords: { push: key } },
    });
  }
}

// ─── Main auto-match ───────────────────────────────────────────

export async function autoMatchSubscriptions(opts: {
  userId: string;
  windowFrom?: Date;
  windowTo?: Date;
}): Promise<AutoMatchResult> {
  const { userId } = opts;
  const windowTo = opts.windowTo ?? new Date();
  const windowFrom =
    opts.windowFrom ??
    new Date(windowTo.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // Fetch candidate transactions
  const rawCandidates = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: TransactionKind.EXPENSE,
      subscriptionId: null,
      transferId: null,
      occurredAt: { gte: windowFrom, lte: windowTo },
      OR: [
        { subscriptionLinkSource: null },
        { subscriptionLinkSource: { not: "unlinked" } },
      ],
    },
    select: {
      id: true,
      accountId: true,
      amount: true,
      currencyCode: true,
      occurredAt: true,
      name: true,
      subscriptionId: true,
      subscriptionLinkSource: true,
    },
    orderBy: { occurredAt: "asc" },
  });

  if (rawCandidates.length === 0) {
    return { autoLinked: 0, advanced: 0, ambiguousSkipped: 0, suggested: 0 };
  }

  // Fetch active subscriptions with autoMatch=true
  const subs = await db.subscription.findMany({
    where: { userId, isActive: true, deletedAt: null, autoMatch: true },
  });

  if (subs.length === 0) {
    return { autoLinked: 0, advanced: 0, ambiguousSkipped: 0, suggested: 0 };
  }

  const rates = await getLatestRatesMap();

  // Pre-compute normalized names for subs
  const subsWithNames: SubWithMatchInfo[] = subs.map((sub) => ({
    ...sub,
    normalizedName: normalizeMerchant(sub.name),
  }));

  const claimed = new Set<string>();
  // Track which sub has been matched in which period (sub.id → Set<period-key>)
  const subPeriodClaimed = new Map<string, Set<string>>();

  let autoLinked = 0;
  let advanced = 0;
  let ambiguousSkipped = 0;
  let suggested = 0;

  for (const txn of rawCandidates) {
    if (claimed.has(txn.id)) continue;

    const txnKey = normalizeMerchant(txn.name);
    if (!txnKey) continue;

    // ── Tier 1: alias-based AUTO match ────────────────────────

    const aliasMatches = findMatchingSubsByAlias(txnKey, subsWithNames);

    if (aliasMatches.length > 1) {
      // Ambiguous: more than one sub matches this alias
      ambiguousSkipped++;
      continue;
    }

    if (aliasMatches.length === 1) {
      const sub = aliasMatches[0];
      const windowDays =
        sub.billingIntervalMonths >= 12
          ? DATE_WINDOW_DAYS_ANNUAL
          : DATE_WINDOW_DAYS;
      const expectedDates = getExpectedPaymentDates(sub, windowFrom, windowTo);

      // Date gate
      const dateOk = txnWithinDateWindow(txn.occurredAt, expectedDates, windowDays)
        || txn.occurredAt <= new Date(sub.nextPaymentDate.getTime() + windowDays * 24 * 60 * 60 * 1000);

      if (!dateOk) continue;

      // Amount gate (skip for variable price)
      if (!sub.isVariablePrice) {
        const amtOk = amountInTolerance(
          new Prisma.Decimal(txn.amount),
          txn.currencyCode,
          new Prisma.Decimal(sub.price),
          sub.currencyCode,
          rates,
        );
        if (!amtOk) continue;
      }

      // Period deduplication: only link the earliest txn per period per sub
      const periodKey = expectedDates
        .find((d) => Math.abs(txn.occurredAt.getTime() - d.getTime()) <=
          windowDays * 24 * 60 * 60 * 1000
        )?.toISOString() ?? txn.occurredAt.toISOString();

      const subPeriods = subPeriodClaimed.get(sub.id) ?? new Set<string>();
      if (subPeriods.has(periodKey)) {
        // Already linked a txn for this period
        continue;
      }

      try {
        await db.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: txn.id },
            data: {
              subscriptionId: sub.id,
              subscriptionLinkSource: "auto",
            },
          });

          const newNext = advanceNextPaymentDate(
            sub.nextPaymentDate,
            sub.billingIntervalMonths,
            txn.occurredAt,
          );

          let dateAdvanced = false;
          if (newNext > sub.nextPaymentDate) {
            await tx.subscription.update({
              where: { id: sub.id },
              data: { nextPaymentDate: newNext },
            });
            dateAdvanced = true;
          }

          return { dateAdvanced, newNext };
        }).then(({ dateAdvanced, newNext }) => {
          claimed.add(txn.id);
          subPeriods.add(periodKey);
          subPeriodClaimed.set(sub.id, subPeriods);
          autoLinked++;
          if (dateAdvanced) {
            // Update in-memory reference only after successful commit
            sub.nextPaymentDate = newNext;
            advanced++;
          }
        });
      } catch (err) {
        console.error(
          `[subscription-pairing] failed to link txn=${txn.id} sub=${sub.id}:`,
          err,
        );
      }

      continue;
    }

    // ── Tier 2: SUGGEST (count only — no mutation) ────────────

    // Check similarity against all subs
    for (const sub of subsWithNames) {
      const windowDays =
        sub.billingIntervalMonths >= 12
          ? DATE_WINDOW_DAYS_ANNUAL
          : DATE_WINDOW_DAYS;
      const expectedDates = getExpectedPaymentDates(sub, windowFrom, windowTo);

      const similarity = merchantSimilarity(txn.name, sub.name);
      const amtOk = sub.isVariablePrice
        ? true
        : amountInTolerance(
            new Prisma.Decimal(txn.amount),
            txn.currencyCode,
            new Prisma.Decimal(sub.price),
            sub.currencyCode,
            rates,
          );
      const dateOk = txnWithinDateWindow(txn.occurredAt, expectedDates, windowDays);

      if (similarity >= SUGGESTION_SIMILARITY_THRESHOLD || (amtOk && dateOk)) {
        suggested++;
        break;
      }
    }
  }

  console.log(
    `[subscription-pairing] done: autoLinked=${autoLinked} advanced=${advanced} ambiguousSkipped=${ambiguousSkipped} suggested=${suggested}`,
  );

  return { autoLinked, advanced, ambiguousSkipped, suggested };
}

// ─── Suggestions query ─────────────────────────────────────────

/**
 * Returns candidate (transaction, subscription, reason) suggestion pairs
 * for UI display. Does NOT mutate anything.
 * Serialises Decimal to string for safe RSC → client serialisation.
 */
export async function getSubscriptionSuggestions(
  userId: string,
): Promise<Suggestion[]> {
  const windowTo = new Date();
  const windowFrom = new Date(
    windowTo.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );

  const [rawCandidates, subs, rates] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        kind: TransactionKind.EXPENSE,
        subscriptionId: null,
        transferId: null,
        occurredAt: { gte: windowFrom, lte: windowTo },
        OR: [
          { subscriptionLinkSource: null },
          { subscriptionLinkSource: { not: "unlinked" } },
        ],
      },
      select: {
        id: true,
        accountId: true,
        amount: true,
        currencyCode: true,
        occurredAt: true,
        name: true,
        subscriptionId: true,
        subscriptionLinkSource: true,
      },
      orderBy: { occurredAt: "asc" },
    }),
    db.subscription.findMany({
      where: { userId, isActive: true, deletedAt: null, autoMatch: true },
    }),
    getLatestRatesMap(),
  ]);

  const subsWithNames: SubWithMatchInfo[] = subs.map((sub) => ({
    ...sub,
    normalizedName: normalizeMerchant(sub.name),
  }));

  const suggestions: Suggestion[] = [];
  const seen = new Set<string>(); // txnId-subId pairs

  for (const txn of rawCandidates) {
    const txnKey = normalizeMerchant(txn.name);
    if (!txnKey) continue;

    // Check for alias-ambiguous case (alias matches >1 sub — already skipped in auto)
    const aliasMatches = findMatchingSubsByAlias(txnKey, subsWithNames);

    for (const sub of subsWithNames) {
      const pairKey = `${txn.id}:${sub.id}`;
      if (seen.has(pairKey)) continue;

      const windowDays =
        sub.billingIntervalMonths >= 12
          ? DATE_WINDOW_DAYS_ANNUAL
          : DATE_WINDOW_DAYS;
      const expectedDates = getExpectedPaymentDates(sub, windowFrom, windowTo);

      let reason: Suggestion["reason"] | null = null;

      if (aliasMatches.length > 1 && aliasMatches.some((s) => s.id === sub.id)) {
        reason = "alias_ambiguous";
      } else {
        const similarity = merchantSimilarity(txn.name, sub.name);
        const amtOk = sub.isVariablePrice
          ? true
          : amountInTolerance(
              new Prisma.Decimal(txn.amount),
              txn.currencyCode,
              new Prisma.Decimal(sub.price),
              sub.currencyCode,
              rates,
            );
        const dateOk = txnWithinDateWindow(txn.occurredAt, expectedDates, windowDays);

        if (similarity >= SUGGESTION_SIMILARITY_THRESHOLD) {
          reason = "similarity";
        } else if (amtOk && dateOk) {
          reason = "amount_date";
        }
      }

      if (!reason) continue;

      seen.add(pairKey);
      suggestions.push({
        transaction: {
          id: txn.id,
          name: txn.name,
          amount: new Prisma.Decimal(txn.amount).toFixed(2),
          currencyCode: txn.currencyCode,
          occurredAt: txn.occurredAt,
          accountId: txn.accountId,
        },
        subscription: {
          id: sub.id,
          name: sub.name,
          price: new Prisma.Decimal(sub.price).toFixed(2),
          currencyCode: sub.currencyCode,
          billingIntervalMonths: sub.billingIntervalMonths,
          nextPaymentDate: sub.nextPaymentDate,
          isVariablePrice: sub.isVariablePrice,
        },
        reason,
      });
    }
  }

  return suggestions;
}
