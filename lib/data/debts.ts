import {
  DebtDirection,
  Prisma,
  TransactionKind,
  TransactionStatus,
} from "@prisma/client";
import type { PersonalDebt, Transaction, TransactionFact, Currency } from "@prisma/client";
import { db } from "@/lib/db";
import { confirmedAmount } from "./transactions";

export type DebtWithTxns = PersonalDebt & {
  currency: Currency;
  transactions: (Transaction & { facts: TransactionFact[] })[];
};

export type DebtProgress = {
  returnedAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal;
  progressPct: number;
  returnsCount: number;
  nextExpected: { amount: Prisma.Decimal; plannedAt: Date | null; id: string } | null;
};

// Инверсный kind: для LENT (я дал) возвраты приходят → DEBT_IN;
// для BORROWED (мне дали) возвраты уходят → DEBT_OUT.
export function returnKindFor(direction: DebtDirection): TransactionKind {
  return direction === DebtDirection.LENT
    ? TransactionKind.DEBT_IN
    : TransactionKind.DEBT_OUT;
}

// Kind инициальной транзакции: LENT = деньги уходят, BORROWED = приходят.
export function initialKindFor(direction: DebtDirection): TransactionKind {
  return direction === DebtDirection.LENT
    ? TransactionKind.DEBT_OUT
    : TransactionKind.DEBT_IN;
}

export function computeDebtProgress(debt: DebtWithTxns): DebtProgress {
  const returnKind = returnKindFor(debt.direction);
  const returnTxns = debt.transactions.filter(
    (t) => t.kind === returnKind && !t.deletedAt,
  );

  // Σ(confirmed) по возвратам: DONE + PARTIAL.
  const returned = returnTxns.reduce(
    (acc, t) => acc.plus(confirmedAmount(t)),
    new Prisma.Decimal(0),
  );

  const principal = new Prisma.Decimal(debt.principal);
  const remaining = Prisma.Decimal.max(principal.minus(returned), 0);
  const progressPct = principal.isZero()
    ? 0
    : Math.min(
        100,
        Math.floor(returned.div(principal).times(100).toNumber()),
      );

  const returnsCount = returnTxns.filter(
    (t) => t.status !== TransactionStatus.CANCELLED,
  ).length;

  const now = Date.now();
  const nextTxn = returnTxns
    .filter(
      (t) =>
        (t.status === TransactionStatus.PLANNED ||
          t.status === TransactionStatus.PARTIAL) &&
        t.plannedAt &&
        t.plannedAt.getTime() >= now,
    )
    .sort((a, b) => (a.plannedAt!.getTime() - b.plannedAt!.getTime()))[0];

  const nextExpected = nextTxn
    ? {
        amount: new Prisma.Decimal(nextTxn.amount),
        plannedAt: nextTxn.plannedAt,
        id: nextTxn.id,
      }
    : null;

  return { returnedAmount: returned, remainingAmount: remaining, progressPct, returnsCount, nextExpected };
}

export async function getPersonalDebtsWithProgress(
  userId: string,
  opts: { direction?: DebtDirection; status?: "open" | "closed" | "all" } = {},
): Promise<(DebtWithTxns & DebtProgress)[]> {
  const where: Prisma.PersonalDebtWhereInput = { userId };
  if (opts.direction) where.direction = opts.direction;
  const statusFilter = opts.status ?? "open";
  if (statusFilter === "open") where.closedAt = null;
  else if (statusFilter === "closed") where.closedAt = { not: null };

  const rows = await db.personalDebt.findMany({
    where,
    orderBy: { openedAt: "desc" },
    include: {
      currency: true,
      transactions: {
        where: { deletedAt: null },
        include: { facts: true },
        orderBy: { occurredAt: "asc" },
      },
    },
  });
  return rows.map((d) => ({ ...d, ...computeDebtProgress(d) }));
}

export async function getPersonalDebtWithProgress(
  userId: string,
  id: string,
): Promise<(DebtWithTxns & DebtProgress) | null> {
  const row = await db.personalDebt.findFirst({
    where: { id, userId },
    include: {
      currency: true,
      transactions: {
        where: { deletedAt: null },
        include: { facts: true },
        orderBy: { occurredAt: "asc" },
      },
    },
  });
  if (!row) return null;
  return { ...row, ...computeDebtProgress(row) };
}
