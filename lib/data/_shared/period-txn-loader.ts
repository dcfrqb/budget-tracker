import { cache } from "react";
import { TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCompensationProjection } from "@/lib/data/_shared/compensation-projection";

// ─────────────────────────────────────────────────────────────
// loadPeriodFlowCount — DB-aggregate replacement for the "flowAll"
// fetch+JS-count pattern.
//
// Returns the same txCount semantics as period-aggregates getPeriodFlow:
//   txCount = count(transferId IS NULL AND kind != TRANSFER)
//           + count(DISTINCT transferId WHERE transferId IS NOT NULL)
// Both queries run in parallel via Promise.all.
// ─────────────────────────────────────────────────────────────

export type PeriodFlowCount = {
  nonTransferCount: number;
  distinctTransferCount: number;
  txCount: number;
};

export const loadPeriodFlowCount = cache(async (
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<PeriodFlowCount> => {
  const from = new Date(fromISO);
  const to = new Date(toISO);

  const [transferGroups, nonTransferCount] = await Promise.all([
    db.transaction.groupBy({
      by: ["transferId"],
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: from, lte: to },
        transferId: { not: null },
      },
    }),
    db.transaction.count({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: from, lte: to },
        transferId: null,
        kind: { not: TransactionKind.TRANSFER },
      },
    }),
  ]);

  const distinctTransferCount = transferGroups.length;
  return {
    nonTransferCount,
    distinctTransferCount,
    txCount: nonTransferCount + distinctTransferCount,
  };
});

// ─────────────────────────────────────────────────────────────
// loadPeriodTxns — cache()-wrapped period loader.
//
// Args are ALL primitives so React 19 cache() keys by value (Map),
// not by reference (WeakMap). Never pass Date or DateRange here.
//
// variant "flow":
//   kind IN [INCOME, EXPENSE], status IN [DONE, PARTIAL],
//   transferId IS NULL, whereExcludeNonMain applied.
//   SELECT superset: id, kind, status, amount, currencyCode,
//   categoryId, occurredAt, transferId, facts.amount.
//   Date boundary: gte fromISO, lte toISO (inclusive on both ends).
//
// variant "forecastMonth":
//   kind IN [INCOME, EXPENSE], status NOT IN [CANCELLED],
//   transferId IS NULL, whereExcludeNonMain applied.
//   SELECT: id, kind, amount, currencyCode (no facts, no occurredAt).
//   Date boundary: gte fromISO, lte toISO.
// ─────────────────────────────────────────────────────────────

export type FlowRow = {
  id: string;
  kind: TransactionKind;
  status: TransactionStatus;
  amount: import("@prisma/client").Prisma.Decimal;
  currencyCode: string;
  categoryId: string | null;
  occurredAt: Date;
  transferId: string | null;
  facts: { amount: import("@prisma/client").Prisma.Decimal }[];
};

export type ForecastMonthRow = {
  id: string;
  kind: TransactionKind;
  amount: import("@prisma/client").Prisma.Decimal;
  currencyCode: string;
};

export function loadPeriodTxns(
  userId: string,
  fromISO: string,
  toISO: string,
  variant: "flow",
): Promise<FlowRow[]>;
export function loadPeriodTxns(
  userId: string,
  fromISO: string,
  toISO: string,
  variant: "forecastMonth",
): Promise<ForecastMonthRow[]>;

// Thin overload dispatcher — intentionally NOT cache()-wrapped itself.
// Dedup lives in the inner `_loadPeriodTxns`, which React `cache()` keys by
// the *primitive* arg values (string userId/fromISO/toISO/variant). Two callers
// with the same window+variant collapse to one DB query within a request.
export function loadPeriodTxns(
  userId: string,
  fromISO: string,
  toISO: string,
  variant: "flow" | "forecastMonth",
): Promise<FlowRow[] | ForecastMonthRow[]> {
  return _loadPeriodTxns(userId, fromISO, toISO, variant);
}

const _loadPeriodTxns = cache(async (
  userId: string,
  fromISO: string,
  toISO: string,
  variant: "flow" | "forecastMonth",
): Promise<FlowRow[] | ForecastMonthRow[]> => {
  const from = new Date(fromISO);
  const to = new Date(toISO);

  // Callers also call getCompensationProjection(userId) in their own Promise.all —
  // that's fine: it is cache()-keyed by userId, so this is the same one DB read,
  // not a redundant query. Don't "optimize" this call away.
  const proj = await getCompensationProjection(userId);

  if (variant === "forecastMonth") {
    return db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: from, lte: to },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
        transferId: null,
        status: { notIn: [TransactionStatus.CANCELLED] },
        ...proj.whereExcludeNonMain,
      },
      select: {
        id: true,
        kind: true,
        amount: true,
        currencyCode: true,
      },
    }) as Promise<ForecastMonthRow[]>;
  }

  // variant === "flow"
  return db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: from, lte: to },
      kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
      transferId: null,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      ...proj.whereExcludeNonMain,
    },
    select: {
      id: true,
      kind: true,
      status: true,
      amount: true,
      currencyCode: true,
      categoryId: true,
      occurredAt: true,
      transferId: true,
      facts: { select: { amount: true } },
    },
  }) as Promise<FlowRow[]>;
});
