import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import type {
  Account,
  Category,
  Currency,
  Institution,
  Transaction,
  TransactionFact,
  Transfer,
} from "@prisma/client";
import { db } from "@/lib/db";
import { convertToBase, getLatestRatesMap } from "./wallet";

import type { ReimbursementFact } from "@prisma/client";

export type TxnWithJoins = Transaction & {
  account: Account & { institution: Institution | null };
  category: Category | null;
  currency: Currency;
  facts: TransactionFact[];
  reimbursements: ReimbursementFact[];
  transfer:
    | (Transfer & { fromAccount: Account; toAccount: Account })
    | null;
};

export type TxnDayRaw = {
  date: string;        // YYYY-MM-DD
  txns: TxnWithJoins[];
};

export type ListFilters = {
  from?: Date;
  to?: Date;
  kind?: TransactionKind[];
  status?: TransactionStatus[];
  accountId?: string;
  categoryId?: string;
  reimbursable?: boolean;
  q?: string;
};

const TXN_INCLUDE = {
  account: { include: { institution: true } },
  category: true,
  currency: true,
  facts: { orderBy: { occurredAt: "desc" as const } },
  reimbursements: { orderBy: { receivedAt: "desc" as const } },
  transfer: { include: { fromAccount: true, toAccount: true } },
};

function buildWhere(userId: string, f: ListFilters): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {
    userId,
    deletedAt: null,
  };
  if (f.from || f.to) {
    where.occurredAt = {};
    if (f.from) where.occurredAt.gte = f.from;
    if (f.to) where.occurredAt.lte = f.to;
  }
  if (f.kind && f.kind.length) where.kind = { in: f.kind };
  if (f.status && f.status.length) where.status = { in: f.status };
  if (f.accountId) where.accountId = f.accountId;
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.reimbursable !== undefined) where.isReimbursable = f.reimbursable;
  if (f.q) {
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      { note: { contains: f.q, mode: "insensitive" } },
    ];
  }
  return where;
}

// Группировка по дню occurredAt (UTC). Order: дни DESC, внутри дня — occurredAt DESC.
export async function getTransactionsGroupedByDay(
  userId: string,
  filters: ListFilters,
): Promise<TxnDayRaw[]> {
  const rows = await db.transaction.findMany({
    where: buildWhere(userId, filters),
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    include: TXN_INCLUDE,
  });
  const byDay = new Map<string, TxnWithJoins[]>();
  for (const t of rows) {
    const key = t.occurredAt.toISOString().slice(0, 10);
    const list = byDay.get(key);
    if (list) list.push(t);
    else byDay.set(key, [t]);
  }
  return [...byDay.entries()].map(([date, txns]) => ({ date, txns }));
}

// Набор kind'ов, считающихся "входом" денег.
const INFLOW_KINDS: TransactionKind[] = [
  TransactionKind.INCOME,
  TransactionKind.REIMBURSEMENT,
  TransactionKind.DEBT_IN,
];
const OUTFLOW_KINDS: TransactionKind[] = [
  TransactionKind.EXPENSE,
  TransactionKind.LOAN_PAYMENT,
  TransactionKind.DEBT_OUT,
];

// Фактическая подтверждённая сумма транзакции:
// DONE → amount, PARTIAL → Σ(TransactionFact.amount), иначе → 0.
// Единая точка для day-totals, period-summary, debt-progress.
export function confirmedAmount(
  t: { status: TransactionStatus; amount: Prisma.Decimal | string; facts: { amount: Prisma.Decimal | string }[] },
): Prisma.Decimal {
  if (t.status === TransactionStatus.DONE) {
    return new Prisma.Decimal(t.amount);
  }
  if (t.status === TransactionStatus.PARTIAL) {
    return t.facts.reduce(
      (acc, f) => acc.plus(f.amount),
      new Prisma.Decimal(0),
    );
  }
  return new Prisma.Decimal(0);
}

// Alias для внутреннего использования (старое имя).
const actualAmount = confirmedAmount;

export type PeriodSummary = {
  inflow:    { value: Prisma.Decimal; count: number };
  outflow:   { value: Prisma.Decimal; count: number };
  transfers: { value: Prisma.Decimal; count: number };
  planned:   { count: number };
  partial:   { count: number };
  net:       Prisma.Decimal;
  totalCount: number;
};

export async function getTransactionById(
  userId: string,
  id: string,
): Promise<TxnWithJoins | null> {
  return db.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    include: TXN_INCLUDE,
  });
}

export async function getTransactionsPeriodSummary(
  userId: string,
  { from, to, baseCcy }: { from?: Date; to?: Date; baseCcy: string },
): Promise<PeriodSummary> {
  const where: Prisma.TransactionWhereInput = {
    userId,
    deletedAt: null,
  };
  if (from || to) {
    where.occurredAt = {};
    if (from) where.occurredAt.gte = from;
    if (to) where.occurredAt.lte = to;
  }

  const [rows, rates] = await Promise.all([
    db.transaction.findMany({ where, include: TXN_INCLUDE }),
    getLatestRatesMap(),
  ]);

  const zero = new Prisma.Decimal(0);
  const result: PeriodSummary = {
    inflow:    { value: zero, count: 0 },
    outflow:   { value: zero, count: 0 },
    transfers: { value: zero, count: 0 },
    planned:   { count: 0 },
    partial:   { count: 0 },
    net:       zero,
    totalCount: rows.length,
  };

  for (const t of rows) {
    if (t.status === TransactionStatus.PLANNED) result.planned.count += 1;
    if (t.status === TransactionStatus.PARTIAL) result.partial.count += 1;

    if (t.kind === TransactionKind.TRANSFER) {
      // Для transfers считаем один раз — только from-сторону, чтобы не дублировать.
      if (t.transfer && t.accountId === t.transfer.fromAccountId) {
        const inBase =
          convertToBase(t.amount, t.currencyCode, baseCcy, rates) ?? zero;
        result.transfers.value = result.transfers.value.plus(inBase);
        result.transfers.count += 1;
      }
      continue;
    }

    const actual = actualAmount(t);
    if (actual.isZero()) continue;
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;

    if (INFLOW_KINDS.includes(t.kind)) {
      result.inflow.value = result.inflow.value.plus(inBase);
      result.inflow.count += 1;
    } else if (OUTFLOW_KINDS.includes(t.kind)) {
      result.outflow.value = result.outflow.value.plus(inBase);
      result.outflow.count += 1;
    }
  }

  result.net = result.inflow.value.minus(result.outflow.value);
  return result;
}

export type FilterSummary = {
  foundCount: number;
  inflow: Prisma.Decimal;
  outflow: Prisma.Decimal;
  transfers: Prisma.Decimal;
  reimburseExpectedTotal: Prisma.Decimal;
  avgPerDay: Prisma.Decimal | null;
};

export async function getTransactionsFilterSummary(
  userId: string,
  filters: ListFilters,
  baseCcy: string,
): Promise<FilterSummary> {
  const where = buildWhere(userId, filters);
  const [rows, rates] = await Promise.all([
    db.transaction.findMany({ where, include: TXN_INCLUDE }),
    getLatestRatesMap(),
  ]);

  const zero = new Prisma.Decimal(0);
  let inflow = zero;
  let outflow = zero;
  let transfers = zero;
  let reimb = zero;

  for (const t of rows) {
    if (t.isReimbursable && t.expectedReimbursement) {
      const v = convertToBase(
        t.expectedReimbursement,
        t.currencyCode,
        baseCcy,
        rates,
      );
      if (v) reimb = reimb.plus(v);
    }
    if (t.kind === TransactionKind.TRANSFER) {
      if (t.transfer && t.accountId === t.transfer.fromAccountId) {
        const v = convertToBase(t.amount, t.currencyCode, baseCcy, rates);
        if (v) transfers = transfers.plus(v);
      }
      continue;
    }
    const actual = actualAmount(t);
    if (actual.isZero()) continue;
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;
    if (INFLOW_KINDS.includes(t.kind)) inflow = inflow.plus(inBase);
    else if (OUTFLOW_KINDS.includes(t.kind)) outflow = outflow.plus(inBase);
  }

  let avgPerDay: Prisma.Decimal | null = null;
  if (filters.from && filters.to) {
    const days = Math.max(
      1,
      Math.ceil((filters.to.getTime() - filters.from.getTime()) / 86400000),
    );
    avgPerDay = inflow.minus(outflow).div(days);
  }

  return {
    foundCount: rows.length,
    inflow,
    outflow,
    transfers,
    reimburseExpectedTotal: reimb,
    avgPerDay,
  };
}
