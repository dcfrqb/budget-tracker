// ─────────────────────────────────────────────────────────────
// Subscription data access
// ─────────────────────────────────────────────────────────────

import { cache } from "react";
import { Prisma } from "@prisma/client";
import type { Currency, SharingType, Subscription, SubscriptionShare } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { convertToBase, getLatestRatesMap } from "@/lib/data/wallet";
import { computeMyCost } from "@/lib/subscription-share";

// ─── Type exports ──────────────────────────────────────────

export type SubscriptionWithDetails = Subscription & {
  shares: SubscriptionShare[];
  currency: Currency;
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
  return db.subscription.findMany({
    where: {
      userId,
      isActive: true,
      deletedAt: null,
    },
    include: {
      shares: true,
      currency: true,
    },
    orderBy: [
      { sharingType: "asc" },
      { nextPaymentDate: "asc" },
    ],
  });
});

// ─── Totals type ──────────────────────────────────────────

export type SubscriptionTotals = {
  activeCount: number;
  /** Monthly base cost, all converted to RUB */
  monthlyBase: Prisma.Decimal;
  /** My personal cost portion (PERSONAL subs) */
  personalBase: Prisma.Decimal;
  /** My split cost portion (SPLIT subs) */
  splitBase: Prisma.Decimal;
  /** PAID_FOR_OTHERS full price (I pay all) */
  paidForOthersBase: Prisma.Decimal;
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

    // Monthly cost normalisation
    const monthly = sub.price.div(new Prisma.Decimal(sub.billingIntervalMonths));

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
    },
  };
});

// paySubscription was moved to lib/data/_mutations/subscriptions.ts
