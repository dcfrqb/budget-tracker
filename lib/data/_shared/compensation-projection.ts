import { cache } from "react";
import { GroupKind, Prisma, TransactionKind } from "@prisma/client";
import { db } from "@/lib/db";
import { convertToBase } from "@/lib/data/wallet";

// ─────────────────────────────────────────────────────────────
// pickMainAndNetto
//
// Given a list of compensation-group legs, determines:
//   - which leg is the "main" (max |base| within winning side)
//   - nettoBase: |sumExpense − sumIncome| in baseCcy
//   - nettoSign: +1 if winning side = INCOME, -1 if EXPENSE
//   - categoryIdForAggregation: categoryId of max-|base| EXPENSE leg
//
// Throws "compensation_needs_mixed_kinds" if no mixed exp/inc.
// Throws "fx_rate_missing" if any leg can't convert to baseCcy.
// ─────────────────────────────────────────────────────────────

export type PickMainResult = {
  mainTxnId: string;
  nettoBase: Prisma.Decimal;
  nettoSign: number;
  categoryIdForAggregation: string | null;
};

type LegInput = {
  id: string;
  kind: TransactionKind;
  amount: Prisma.Decimal | string;
  currencyCode: string;
  categoryId: string | null;
};

export function pickMainAndNetto(
  txns: LegInput[],
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
): PickMainResult {
  const expenses = txns.filter((t) => t.kind === TransactionKind.EXPENSE);
  const incomes = txns.filter((t) => t.kind === TransactionKind.INCOME);

  if (expenses.length === 0 || incomes.length === 0) {
    throw new Error("compensation_needs_mixed_kinds");
  }

  type LegWithBase = LegInput & { baseAmt: Prisma.Decimal };

  function toBase(leg: LegInput): LegWithBase {
    const amt = new Prisma.Decimal(leg.amount).abs();
    const inBase = convertToBase(amt, leg.currencyCode, baseCcy, rates);
    if (!inBase) throw new Error("fx_rate_missing");
    return { ...leg, baseAmt: inBase };
  }

  const expWithBase = expenses.map(toBase);
  const incWithBase = incomes.map(toBase);

  const zero = new Prisma.Decimal(0);
  const sumExp = expWithBase.reduce((acc, l) => acc.plus(l.baseAmt), zero);
  const sumInc = incWithBase.reduce((acc, l) => acc.plus(l.baseAmt), zero);

  const winningSide: "EXPENSE" | "INCOME" = sumExp.greaterThan(sumInc) ? "EXPENSE" : "INCOME";
  const nettoBase = sumExp.minus(sumInc).abs();
  const nettoSign = winningSide === "INCOME" ? 1 : -1;

  const winningSideLegs = winningSide === "EXPENSE" ? expWithBase : incWithBase;
  const mainLeg = winningSideLegs.reduce((max, leg) =>
    leg.baseAmt.greaterThan(max.baseAmt) ? leg : max,
  );

  const maxExpLeg = expWithBase.reduce((max, leg) =>
    leg.baseAmt.greaterThan(max.baseAmt) ? leg : max,
  );
  const categoryIdForAggregation = maxExpLeg.categoryId;

  return {
    mainTxnId: mainLeg.id,
    nettoBase,
    nettoSign,
    categoryIdForAggregation,
  };
}

// ─────────────────────────────────────────────────────────────
// Canonical direction sets — single source of truth.
// Used by pickMergeMain, createMergeGroup, and kindDirection.
// ─────────────────────────────────────────────────────────────

export const INFLOW_KINDS: TransactionKind[] = [
  TransactionKind.INCOME,
  TransactionKind.DEBT_IN,
];

export const OUTFLOW_KINDS: TransactionKind[] = [
  TransactionKind.EXPENSE,
  TransactionKind.LOAN_PAYMENT,
  TransactionKind.DEBT_OUT,
];

// ─────────────────────────────────────────────────────────────
// pickMergeMain
//
// Given same-direction legs, determines:
//   - mainTxnId: leg with max |base| amount
//   - nettoBase: Σ|base| (cached representative sum)
//   - nettoSign: +1 for inflow legs, -1 for outflow legs
//
// Throws "merge_needs_same_sign" if legs are mixed direction.
// Throws "fx_rate_missing" if any leg can't convert to baseCcy.
// ─────────────────────────────────────────────────────────────

export function pickMergeMain(
  txns: LegInput[],
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
): PickMainResult {
  const hasInflow = txns.some((t) => INFLOW_KINDS.includes(t.kind));
  const hasOutflow = txns.some((t) => OUTFLOW_KINDS.includes(t.kind));
  if (hasInflow && hasOutflow) throw new Error("merge_needs_same_sign");

  type LegWithBase = LegInput & { baseAmt: Prisma.Decimal };

  function toBase(leg: LegInput): LegWithBase {
    const amt = new Prisma.Decimal(leg.amount).abs();
    const inBase = convertToBase(amt, leg.currencyCode, baseCcy, rates);
    if (!inBase) throw new Error("fx_rate_missing");
    return { ...leg, baseAmt: inBase };
  }

  const withBase = txns.map(toBase);
  const zero = new Prisma.Decimal(0);
  const nettoBase = withBase.reduce((acc, l) => acc.plus(l.baseAmt), zero);
  const nettoSign = hasInflow ? 1 : -1;
  const mainLeg = withBase.reduce((max, leg) =>
    leg.baseAmt.greaterThan(max.baseAmt) ? leg : max,
  );

  return {
    mainTxnId: mainLeg.id,
    nettoBase,
    nettoSign,
    categoryIdForAggregation: null,
  };
}

// ─────────────────────────────────────────────────────────────
// CompensationProjection
//
// Loaded once per request. Exposes:
//   - whereExcludeNonMain: adds compensationGroupId IS NULL OR id = mainTxnId
//     (COMPENSATION non-mains only; MERGE non-mains stay visible for aggregators)
//   - rewriteAmount(txnId): returns { netBase, sign } for COMPENSATION mains only;
//     returns null for MERGE mains (no rewrite — aggregators count at own amount)
//   - groupByMainTxnId: info per main txn, includes `kind` for branching in view layer
//   - mergeNonMainIds: set of MERGE non-main txn ids (for in-memory feed folding)
// ─────────────────────────────────────────────────────────────

export type CompensationProjection = {
  whereExcludeNonMain: Prisma.TransactionWhereInput;
  rewriteAmount: (txnId: string) => { netBase: Prisma.Decimal; sign: number } | null;
  groupByMainTxnId: Map<string, {
    groupId: string;
    kind: GroupKind;
    nettoBase: Prisma.Decimal;
    nettoSign: number;
    categoryIdForAggregation: string | null;
    memberCount: number;
  }>;
  mergeNonMainIds: Set<string>;
};

export const getCompensationProjection = cache(async (
  userId: string,
): Promise<CompensationProjection> => {
  const groups = await db.compensationGroup.findMany({
    where: { userId },
    select: {
      id: true,
      kind: true,
      mainTxnId: true,
      nettoBase: true,
      nettoSign: true,
      categoryIdForAggregation: true,
      transactions: { select: { id: true } },
    },
  });

  const mainTxnIds = new Set(groups.map((g) => g.mainTxnId));
  // Only COMPENSATION non-mains are excluded at DB query level
  const compensationNonMainIds = new Set<string>();
  // MERGE non-mains are folded in-memory in the feed only
  const mergeNonMainIds = new Set<string>();

  const groupByMainTxnId = new Map<string, {
    groupId: string;
    kind: GroupKind;
    nettoBase: Prisma.Decimal;
    nettoSign: number;
    categoryIdForAggregation: string | null;
    memberCount: number;
  }>();

  for (const g of groups) {
    groupByMainTxnId.set(g.mainTxnId, {
      groupId: g.id,
      kind: g.kind,
      nettoBase: new Prisma.Decimal(g.nettoBase),
      nettoSign: g.nettoSign,
      categoryIdForAggregation: g.categoryIdForAggregation,
      memberCount: g.transactions.length,
    });
    for (const m of g.transactions) {
      if (m.id !== g.mainTxnId) {
        if (g.kind === GroupKind.COMPENSATION) {
          compensationNonMainIds.add(m.id);
        } else {
          mergeNonMainIds.add(m.id);
        }
      }
    }
  }

  // Exclude only COMPENSATION non-main rows at DB level.
  // MERGE non-mains pass through (no DB exclusion) so aggregators count them individually.
  // The feed later folds MERGE non-mains in-memory using mergeNonMainIds.
  const whereExcludeNonMain: Prisma.TransactionWhereInput =
    compensationNonMainIds.size === 0
      ? {}
      : {
          OR: [
            // Keep ungrouped rows
            { compensationGroupId: null },
            // Keep all mains (both COMPENSATION and MERGE)
            { id: { in: Array.from(mainTxnIds) } },
            // Keep MERGE non-mains (they need to reach aggregators)
            ...(mergeNonMainIds.size > 0 ? [{ id: { in: Array.from(mergeNonMainIds) } }] : []),
          ],
        };

  // rewriteAmount: only for COMPENSATION mains — returns netto override.
  // MERGE mains return null: aggregators use each member's own amount.
  const rewriteAmount = (txnId: string) => {
    const g = groupByMainTxnId.get(txnId);
    if (!g) return null;
    if (g.kind !== GroupKind.COMPENSATION) return null;
    return { netBase: g.nettoBase, sign: g.nettoSign };
  };

  return { whereExcludeNonMain, rewriteAmount, groupByMainTxnId, mergeNonMainIds };
});
