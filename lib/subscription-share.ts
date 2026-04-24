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
