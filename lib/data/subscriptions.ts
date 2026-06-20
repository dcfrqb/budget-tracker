// ─────────────────────────────────────────────────────────────
// Subscription data access
// ─────────────────────────────────────────────────────────────

import { cache } from "react";
import { Prisma } from "@prisma/client";
import type { Currency, SharingType, Subscription, SubscriptionShare } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { convertToBase, getLatestRatesMap } from "@/lib/data/wallet";
import { computeMyCost, estimateRecurringAmount } from "@/lib/subscription-share";

// ─── Type exports ──────────────────────────────────────────

export type SubscriptionRecentCharge = {
  amount: Prisma.Decimal;
  currencyCode: string;
  occurredAt: Date;
};

export type SubscriptionWithDetails = Subscription & {
  shares: SubscriptionShare[];
  currency: Currency;
  transactions: SubscriptionRecentCharge[];
  /** Effective monthly amount after variable-price estimation */
  effectiveMonthly: string;
};

// ─── Queries ───────────────────────────────────────────────

/**
 * Returns all active (non-deleted, isActive=true) subscriptions for user,
 * sorted by sharingType asc, then nextPaymentDate asc.
 * Wrapped in React.cache() to deduplicate across page + @summary slot.
 */
export const getSubscriptions = cache(async (
  userId: string,
): Promise<SubscriptionWithDetails[]> => {
  const raw = await db.subscription.findMany({
    where: {
      userId,
      isActive: true,
      deletedAt: null,
    },
    include: {
      shares: true,
      currency: true,
      transactions: {
        where: { deletedAt: null },
        orderBy: { occurredAt: "desc" },
        take: 3,
        select: { amount: true, currencyCode: true, occurredAt: true },
      },
    },
    orderBy: [
      { sharingType: "asc" },
      { nextPaymentDate: "asc" },
    ],
  });

  return raw.map((sub) => {
    const effective = estimateRecurringAmount({
      price: sub.price,
      isVariablePrice: sub.isVariablePrice ?? false,
      recentCharges: sub.transactions,
      currency: sub.currencyCode,
    });
    const effectiveMonthly = effective
      .div(new Prisma.Decimal(sub.billingIntervalMonths))
      .toFixed(2);
    return { ...sub, effectiveMonthly };
  });
});

// ─── Totals type ──────────────────────────────────────────

export type SubscriptionTotals = {
  activeCount: number;
  /** Monthly base cost, all converted to RUB (full sticker price, all subs) */
  monthlyBase: Prisma.Decimal;
  /** My personal cost portion (PERSONAL subs) */
  personalBase: Prisma.Decimal;
  /** My split cost portion (SPLIT subs) */
  splitBase: Prisma.Decimal;
  /** PAID_FOR_OTHERS full price (I pay all) */
  paidForOthersBase: Prisma.Decimal;
  /** My real monthly outflow = personalBase + splitBase (headline figure) */
  mineMonthlyBase: Prisma.Decimal;
};

// ─── Grouped result type ──────────────────────────────────

export type SubscriptionsGrouped = {
  personal: SubscriptionWithDetails[];
  split: SubscriptionWithDetails[];
  paidForOthers: SubscriptionWithDetails[];
  totals: SubscriptionTotals;
};

/**
 * Returns subscriptions grouped by SharingType plus aggregated totals.
 * Non-RUB subscriptions are converted at current rates.
 * Subscriptions without a rate are skipped with a console.warn.
 */
export const getSubscriptionsGrouped = cache(async (
  userId: string,
): Promise<SubscriptionsGrouped> => {
  const [subs, rates] = await Promise.all([
    getSubscriptions(userId),
    getLatestRatesMap(),
  ]);

  const BASE_CCY = DEFAULT_CURRENCY; // "RUB"

  const personal: SubscriptionWithDetails[] = [];
  const split: SubscriptionWithDetails[] = [];
  const paidForOthers: SubscriptionWithDetails[] = [];

  const zero = new Prisma.Decimal(0);
  let monthlyBase = zero;
  let personalBase = zero;
  let splitBase = zero;
  let paidForOthersBase = zero;

  for (const sub of subs) {
    // Group
    if (sub.sharingType === "PERSONAL") personal.push(sub);
    else if (sub.sharingType === "SPLIT") split.push(sub);
    else paidForOthers.push(sub);

    // Monthly cost normalisation — use effective amount (variable-price aware)
    const effectivePrice = estimateRecurringAmount({
      price: sub.price,
      isVariablePrice: sub.isVariablePrice ?? false,
      recentCharges: sub.transactions,
      currency: sub.currencyCode,
    });
    const monthly = effectivePrice.div(new Prisma.Decimal(sub.billingIntervalMonths));

    // Convert to RUB
    const monthlyRub = convertToBase(monthly, sub.currencyCode, BASE_CCY, rates);
    if (!monthlyRub) {
      console.warn(
        `[subscriptions] skip sub ${sub.id}: no rate ${sub.currencyCode}→${BASE_CCY}`,
      );
      continue;
    }

    monthlyBase = monthlyBase.plus(monthlyRub);

    // Compute my share (monthly)
    const myMonthly = computeMyCost({
      price: monthly,
      shareMode: sub.sharingType as SharingType,
      totalUsers: sub.totalUsers,
      shares: sub.shares.map((s) => ({ amount: s.amount ? new Prisma.Decimal(s.amount) : null })),
    });

    const myRub = convertToBase(myMonthly, sub.currencyCode, BASE_CCY, rates);
    if (!myRub) continue;

    if (sub.sharingType === "PERSONAL") personalBase = personalBase.plus(myRub);
    else if (sub.sharingType === "SPLIT") splitBase = splitBase.plus(myRub);
    else paidForOthersBase = paidForOthersBase.plus(myRub);
  }

  return {
    personal,
    split,
    paidForOthers,
    totals: {
      activeCount: subs.length,
      monthlyBase,
      personalBase,
      splitBase,
      paidForOthersBase,
      mineMonthlyBase: personalBase.plus(splitBase),
    },
  };
});

// paySubscription was moved to lib/data/_mutations/subscriptions.ts

// ─── Recent unlinked expenses (for Pay dialog link mode) ─────

export type RecentUnlinkedExpense = {
  id: string;
  name: string;
  amount: string;
  currencyCode: string;
  occurredAt: Date;
  accountName: string | null;
};

/**
 * Returns recent EXPENSE transactions that are not yet linked to any subscription.
 * Used for the "link a real charge" mode in the Pay dialog.
 */
export async function getRecentUnlinkedExpenses(
  userId: string,
  subId: string,
  limit = 20,
): Promise<RecentUnlinkedExpense[]> {
  const sub = await db.subscription.findFirst({
    where: { id: subId, userId, deletedAt: null },
    select: { price: true, currencyCode: true, nextPaymentDate: true, billingIntervalMonths: true },
  });

  // Search within ±60 days of next payment date or last 90 days
  const windowTo = new Date();
  const windowFrom = new Date(windowTo.getTime() - 90 * 24 * 60 * 60 * 1000);

  const rows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: "EXPENSE",
      subscriptionId: null,
      transferId: null,
      occurredAt: { gte: windowFrom, lte: windowTo },
      ...(sub ? { currencyCode: sub.currencyCode } : {}),
      OR: [
        { subscriptionLinkSource: null },
        { subscriptionLinkSource: { not: "unlinked" } },
      ],
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: { account: { select: { name: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: new Prisma.Decimal(r.amount).toFixed(2),
    currencyCode: r.currencyCode,
    occurredAt: r.occurredAt,
    accountName: r.account.name ?? null,
  }));
}

// ─── Subscription charge history ────────────────────────────

export type SubscriptionCharge = {
  id: string;
  occurredAt: Date;
  amount: string;
  currencyCode: string;
  accountName: string | null;
  subscriptionLinkSource: string | null;
};

/**
 * Returns all linked transactions for a subscription, serialized for RSC→client safety.
 */
export async function getSubscriptionCharges(
  userId: string,
  subId: string,
): Promise<SubscriptionCharge[]> {
  const rows = await db.transaction.findMany({
    where: { subscriptionId: subId, userId, deletedAt: null },
    orderBy: { occurredAt: "desc" },
    include: { account: { select: { name: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurredAt,
    amount: new Prisma.Decimal(r.amount).toFixed(2),
    currencyCode: r.currencyCode,
    accountName: r.account.name ?? null,
    subscriptionLinkSource: r.subscriptionLinkSource,
  }));
}
