import { cache } from "react";
import { Prisma, TransactionKind } from "@prisma/client";
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
// CompensationProjection
//
// Loaded once per request. Exposes:
//   - whereExcludeNonMain: adds compensationGroupId IS NULL OR id = mainTxnId
//   - rewriteAmount(txnId): returns { netBase, sign } for main rows, null for others
// ─────────────────────────────────────────────────────────────

export type CompensationProjection = {
  whereExcludeNonMain: Prisma.TransactionWhereInput;
  rewriteAmount: (txnId: string) => { netBase: Prisma.Decimal; sign: number } | null;
  groupByMainTxnId: Map<string, {
    groupId: string;
    nettoBase: Prisma.Decimal;
    nettoSign: number;
    categoryIdForAggregation: string | null;
    memberCount: number;
  }>;
};

export const getCompensationProjection = cache(async (
  userId: string,
): Promise<CompensationProjection> => {
  const groups = await db.compensationGroup.findMany({
    where: { userId },
    select: {
      id: true,
      mainTxnId: true,
      nettoBase: true,
      nettoSign: true,
      categoryIdForAggregation: true,
      transactions: { select: { id: true } },
    },
  });

  const mainTxnIds = new Set(groups.map((g) => g.mainTxnId));
  const nonMainGrouped = new Set<string>();
  const groupByMainTxnId = new Map<string, {
    groupId: string;
    nettoBase: Prisma.Decimal;
    nettoSign: number;
    categoryIdForAggregation: string | null;
    memberCount: number;
  }>();

  for (const g of groups) {
    groupByMainTxnId.set(g.mainTxnId, {
      groupId: g.id,
      nettoBase: new Prisma.Decimal(g.nettoBase),
      nettoSign: g.nettoSign,
      categoryIdForAggregation: g.categoryIdForAggregation,
      memberCount: g.transactions.length,
    });
    for (const m of g.transactions) {
      if (m.id !== g.mainTxnId) {
        nonMainGrouped.add(m.id);
      }
    }
  }

  // Exclude rows that are non-main members of a compensation group:
  // keep rows where compensationGroupId IS NULL OR row is a main txn.
  const whereExcludeNonMain: Prisma.TransactionWhereInput =
    nonMainGrouped.size === 0
      ? {}
      : {
          OR: [
            { compensationGroupId: null },
            { id: { in: Array.from(mainTxnIds) } },
          ],
        };

  const rewriteAmount = (txnId: string) => {
    const g = groupByMainTxnId.get(txnId);
    if (!g) return null;
    return { netBase: g.nettoBase, sign: g.nettoSign };
  };

  return { whereExcludeNonMain, rewriteAmount, groupByMainTxnId };
});
