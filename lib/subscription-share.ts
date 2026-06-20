// ─────────────────────────────────────────────────────────────
// Subscription cost computation — pure functions, no I/O
// ─────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import type { SharingType } from "@prisma/client";

export type ShareInput = {
  amount: Prisma.Decimal | null;
};

export type ComputeMyCostInput = {
  price: Prisma.Decimal;
  shareMode: SharingType;
  totalUsers?: number | null;
  shares: ShareInput[];
};

/**
 * Computes my personal cost for a subscription.
 *
 * PERSONAL / PAID_FOR_OTHERS → full price
 * SPLIT →
 *   Semantics (confirmed by seed fixtures — see seed.ts seedSubscriptions()):
 *   - `shares[]` contains rows for ALL split participants, including "me"
 *     (the subscription owner / DEFAULT_USER).
 *     Netflix: totalUsers=3, shares=[Владимир(me), Маша, Лена] — all three.
 *     Figma:   totalUsers=2, shares=[Владимир(me), Маша]       — both.
 *   - "Me" is identified by the FamilyMember whose userId === currentUserId
 *     (role OWNER in the seed).  No special "implicit remainder" slot.
 *   - `totalUsers` MUST equal `shares.length` in well-formed data.
 *
 *   Algorithm:
 *   - n = totalUsers (authoritative).
 *     Fallback when null: shares.length — treat shares as the full participant
 *     list (matches seed fixtures, safe for legacy records).
 *   - explicit shares: those with a fixed amount → sum them up.
 *   - implicit slots = n - explicit.length → equal-split among remaining slots
 *     (my slot is one of them when my row has amount === null).
 *   - If all implicit: my share = price / n.
 *   - Mixed: remainder = price − sum(explicit); my share = remainder / implicitSlots.
 *   - If all explicit (no implicit slots): my share = price − sum(explicit) (remainder).
 */
export function computeMyCost({
  price,
  shareMode,
  totalUsers,
  shares,
}: ComputeMyCostInput): Prisma.Decimal {
  if (shareMode === "PERSONAL" || shareMode === "PAID_FOR_OTHERS") {
    return price;
  }

  // SPLIT: shares[] = ALL participants including me; totalUsers should equal shares.length.
  // no totalUsers: treat shares as the full participant list (matches seed fixtures)
  const n = totalUsers ?? shares.length;
  if (n <= 1) return price;

  const explicit = shares.filter((s) => s.amount !== null);
  const implicit = shares.filter((s) => s.amount === null);

  const sumExplicit = explicit.reduce(
    (acc, s) => acc.plus(s.amount!),
    new Prisma.Decimal(0),
  );

  if (implicit.length === 0) {
    // All participants have explicit amounts — remainder goes to my slot.
    return price.minus(sumExplicit);
  }

  // Implicit slots (null-amount rows including mine) all split the remainder equally.
  // implicitSlots = n - explicit.length = implicit.length (when totalUsers === shares.length).
  const implicitSlots = n - explicit.length;
  const remainder = price.minus(sumExplicit);
  return remainder.div(new Prisma.Decimal(implicitSlots));
}

// ─────────────────────────────────────────────────────────────
// Variable-price estimate
// ─────────────────────────────────────────────────────────────

/**
 * For variable-price subscriptions: groups recent charges by calendar month,
 * sums each month, then averages the monthly sums (capped to last 3 months).
 * Falls back to `price` if no matching charges exist.
 * For fixed-price subscriptions: returns `price` unchanged.
 *
 * Amounts are stored as positive magnitude — no sign flip needed.
 * `recentCharges` should include occurredAt for monthly grouping.
 */
export function estimateRecurringAmount(args: {
  price: Prisma.Decimal;
  isVariablePrice: boolean;
  recentCharges: { amount: Prisma.Decimal; currencyCode: string; occurredAt?: Date }[];
  currency?: string;
  n?: number;
}): Prisma.Decimal {
  if (!args.isVariablePrice) {
    return new Prisma.Decimal(args.price);
  }

  const maxMonths = args.n ?? 3;

  // Filter to same currency as the subscription; drop undated charges to avoid
  // binning them into month "1970-01" and skewing the monthly average.
  const matching = args.recentCharges
    .filter((c) => !!c.occurredAt && (!args.currency || c.currencyCode === args.currency))
    .map((c) => ({
      amount: new Prisma.Decimal(c.amount).abs(),
      occurredAt: c.occurredAt as Date,
    }));

  if (matching.length === 0) {
    return new Prisma.Decimal(args.price);
  }

  // Group charges by calendar month (YYYY-MM key) and sum each month
  const monthMap = new Map<string, Prisma.Decimal>();
  for (const charge of matching) {
    const d = charge.occurredAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? new Prisma.Decimal(0)).plus(charge.amount));
  }

  // Sort months descending, cap to maxMonths
  const sortedMonths = Array.from(monthMap.keys()).sort().reverse().slice(0, maxMonths);

  if (sortedMonths.length === 0) {
    return new Prisma.Decimal(args.price);
  }

  const totalSum = sortedMonths.reduce(
    (acc, k) => acc.plus(monthMap.get(k)!),
    new Prisma.Decimal(0),
  );
  return totalSum.div(new Prisma.Decimal(sortedMonths.length));
}

export type BreakdownResult = {
  mine: Prisma.Decimal;
  personal: Prisma.Decimal;
  split: Prisma.Decimal;
  paidForOthers: Prisma.Decimal;
};

/**
 * Computes cost breakdown by category for a subscription.
 * All values in the subscription's own currency.
 */
export function computeBreakdown(input: ComputeMyCostInput): BreakdownResult {
  const mine = computeMyCost(input);
  const zero = new Prisma.Decimal(0);

  if (input.shareMode === "PERSONAL") {
    return { mine, personal: mine, split: zero, paidForOthers: zero };
  }
  if (input.shareMode === "PAID_FOR_OTHERS") {
    return { mine: input.price, personal: zero, split: zero, paidForOthers: input.price };
  }
  // SPLIT
  return { mine, personal: zero, split: mine, paidForOthers: zero };
}
