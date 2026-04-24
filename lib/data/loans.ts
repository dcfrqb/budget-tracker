import { cache } from "react";
import { Prisma } from "@prisma/client";
import type { Loan, LoanPayment } from "@prisma/client";
import { db } from "@/lib/db";
import { computeAmortization } from "@/lib/amortization";

export type LoanWithPayments = Loan & {
  payments: LoanPayment[];
  _count: { payments: number };
};

export const getLoans = cache(async (userId: string) => {
  return db.loan.findMany({
    where: { userId },
    include: {
      payments: { orderBy: { paidAt: "asc" } },
      _count: { select: { payments: true } },
    },
    orderBy: { startDate: "asc" },
  });
});

export const getLoanById = cache(async (userId: string, id: string) => {
  return db.loan.findFirst({
    where: { id, userId },
    include: {
      payments: { orderBy: { paidAt: "asc" } },
      _count: { select: { payments: true } },
    },
  });
});

export type LoanProgress = {
  paidTotal: Prisma.Decimal;
  paidPrincipal: Prisma.Decimal;
  paidInterest: Prisma.Decimal;
  interestOverpay: Prisma.Decimal;
  remainingPrincipal: Prisma.Decimal;
  nextScheduledN: number | null;
  nextScheduledDate: Date | null;
};

export function computeLoanProgress(
  loan: Loan,
  payments: LoanPayment[],
): LoanProgress {
  const zero = new Prisma.Decimal(0);

  let paidTotal = zero;
  let paidPrincipal = zero;
  let paidInterest = zero;

  for (const p of payments) {
    paidTotal = paidTotal.plus(p.totalAmount);
    paidPrincipal = paidPrincipal.plus(p.principalPart);
    paidInterest = paidInterest.plus(p.interestPart);
  }

  // Сколько ещё должны из основного тела
  const remainingPrincipal = new Prisma.Decimal(loan.principal).minus(paidPrincipal);

  // Переплата = суммарные проценты, которые уже заплачены
  const interestOverpay = paidInterest;

  // Следующий неоплаченный период
  const schedule = computeAmortization({
    principal: new Prisma.Decimal(loan.principal),
    annualRatePct: new Prisma.Decimal(loan.annualRatePct),
    termMonths: loan.termMonths,
    startDate: loan.startDate,
  });

  const nextScheduled = schedule.find((row) => row.n > payments.length);

  return {
    paidTotal,
    paidPrincipal,
    paidInterest,
    interestOverpay,
    remainingPrincipal,
    nextScheduledN: nextScheduled?.n ?? null,
    nextScheduledDate: nextScheduled?.date ?? null,
  };
}
