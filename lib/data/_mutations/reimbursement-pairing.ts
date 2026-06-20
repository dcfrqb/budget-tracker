// ─────────────────────────────────────────────────────────────
// Reimbursement suggestion matcher
// Suggest-only: no mutations here; linking happens via confirmReimbursementAction.
// ─────────────────────────────────────────────────────────────

import { TransactionKind, SharingType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { convertToBase, getLatestRatesMap } from "@/lib/data/wallet";
import { normalizeMerchant } from "@/lib/integrations/merchant";

const LOOKBACK_DAYS = 60;
const AMOUNT_TOLERANCE = 0.05;

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

/**
 * For each active PAID_FOR_OTHERS subscription with reimbursementExpected set,
 * scans INCOME transactions (within 60 days, unlinked) for amount matches.
 * Pairs each matched income with the sub's most recent un-reimbursed linked spend.
 * Returns serialized suggestions (all Decimals as strings).
 */
export async function getReimbursementSuggestions(
  userId: string,
): Promise<ReimbursementSuggestion[]> {
  try {
  const windowTo = new Date();
  const windowFrom = new Date(windowTo.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // Fetch PAID_FOR_OTHERS subs with reimbursement configured
  const subs = await db.subscription.findMany({
    where: {
      userId,
      isActive: true,
      deletedAt: null,
      sharingType: SharingType.PAID_FOR_OTHERS,
      reimbursementExpected: { not: null },
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
    const expected = new Prisma.Decimal(sub.reimbursementExpected!);
    const expectedCcy = sub.reimbursementCurrency ?? sub.currencyCode;

    // Normalize reimbursementFrom for soft name matching
    const fromKey = sub.reimbursementFrom ? normalizeMerchant(sub.reimbursementFrom) : null;

    // Hoist per-sub spend lookup outside the income loop — runs once per subscription
    const latestSpend = await db.transaction.findFirst({
      where: {
        userId,
        deletedAt: null,
        kind: TransactionKind.EXPENSE,
        subscriptionId: sub.id,
        compensationGroupId: null,
      },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        amount: true,
        currencyCode: true,
        occurredAt: true,
      },
    });

    for (const income of incomes) {
      const pairKey = `${income.id}:${sub.id}`;
      if (seenIncomePairs.has(pairKey)) continue;

      // Amount check: compare income amount to reimbursementExpected
      const incomeAmount = new Prisma.Decimal(income.amount).abs();
      let amountOk = false;

      if (income.currencyCode === expectedCcy) {
        const diff = incomeAmount.minus(expected).abs();
        if (expected.isZero()) {
          amountOk = incomeAmount.isZero();
        } else {
          amountOk = diff.div(expected).lessThanOrEqualTo(new Prisma.Decimal(AMOUNT_TOLERANCE));
        }
      } else {
        // Cross-currency: convert income to expectedCcy for comparison
        const incomeInExpectedCcy = convertToBase(incomeAmount, income.currencyCode, expectedCcy, rates);
        if (incomeInExpectedCcy) {
          const diff = incomeInExpectedCcy.minus(expected).abs();
          if (!expected.isZero()) {
            amountOk = diff.div(expected).lessThanOrEqualTo(new Prisma.Decimal(AMOUNT_TOLERANCE));
          }
        }
      }

      if (!amountOk) continue;

      // Soft name boost: check if income name contains a token from reimbursementFrom
      let nameMatch = false;
      if (fromKey) {
        const incomeKey = normalizeMerchant(income.name);
        if (incomeKey && (incomeKey.includes(fromKey) || fromKey.includes(incomeKey))) {
          nameMatch = true;
        }
      }

      const reason: ReimbursementSuggestion["reason"] = nameMatch
        ? "amount_and_name_match"
        : "amount_match";

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
        reason,
      });
    }
  }

  return suggestions;
  } catch (err) {
    console.error("[getReimbursementSuggestions] failed:", err);
    return [];
  }
}
