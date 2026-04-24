import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLoanById } from "@/lib/data/loans";
import { computeAmortization } from "@/lib/amortization";
import type {
  LoanCreateInput,
  LoanUpdateInput,
  LoanPaymentCreateInput,
} from "@/lib/validation/loan";

// ─────────────────────────────────────────────────────────────
// Loan mutations
// ─────────────────────────────────────────────────────────────

export async function createLoan(userId: string, input: LoanCreateInput) {
  return db.loan.create({
    data: { ...input, userId },
  });
}

export async function updateLoan(
  userId: string,
  id: string,
  input: LoanUpdateInput,
) {
  const existing = await getLoanById(userId, id);
  if (!existing) throw Object.assign(new Error("loan not found"), { code: "NOT_FOUND" });

  return db.loan.update({ where: { id }, data: input });
}

export async function deleteLoan(userId: string, id: string) {
  const existing = await getLoanById(userId, id);
  if (!existing) throw Object.assign(new Error("loan not found"), { code: "NOT_FOUND" });
  if (existing._count.payments > 0) {
    throw Object.assign(
      new Error("cannot delete loan with existing payments"),
      { code: "CONFLICT" },
    );
  }

  await db.loan.delete({ where: { id } });
  return { id };
}

export async function createLoanPayment(
  userId: string,
  loanId: string,
  input: LoanPaymentCreateInput,
) {
  const loan = await getLoanById(userId, loanId);
  if (!loan) throw Object.assign(new Error("loan not found"), { code: "NOT_FOUND" });

  const paidAt = input.paidAt ?? new Date();
  const totalAmount = new Prisma.Decimal(input.totalAmount);

  const accountId = input.accountId ?? loan.accountId;
  if (!accountId) {
    throw Object.assign(new Error("accountId is required"), { code: "INVALID" });
  }

  const account = await db.account.findFirst({
    where: { id: accountId, userId, deletedAt: null, isArchived: false },
    select: { id: true },
  });
  if (!account) throw Object.assign(new Error("account not found or archived"), { code: "NOT_FOUND" });

  let principalPart: Prisma.Decimal;
  let interestPart: Prisma.Decimal;

  if (input.principalPart != null && input.interestPart != null) {
    principalPart = new Prisma.Decimal(input.principalPart);
    interestPart = new Prisma.Decimal(input.interestPart);
  } else {
    const schedule = computeAmortization({
      principal: new Prisma.Decimal(loan.principal),
      annualRatePct: new Prisma.Decimal(loan.annualRatePct),
      termMonths: loan.termMonths,
      startDate: loan.startDate,
    });
    const nextN = loan.payments.length + 1;
    const scheduledRow = schedule.find((r) => r.n === nextN);

    if (scheduledRow) {
      interestPart = scheduledRow.interestPart;
      const plannedPrincipal = scheduledRow.principalPart;
      const excess = totalAmount.minus(scheduledRow.payment);
      principalPart = excess.gt(0) ? plannedPrincipal.plus(excess) : plannedPrincipal;
      if (totalAmount.lt(scheduledRow.payment)) {
        interestPart = totalAmount.minus(principalPart);
        if (interestPart.lt(0)) {
          interestPart = new Prisma.Decimal(0);
          principalPart = totalAmount;
        }
      }
    } else {
      principalPart = totalAmount;
      interestPart = new Prisma.Decimal(0);
    }
  }

  return db.$transaction(async (tx) => {
    const payment = await tx.loanPayment.create({
      data: { loanId, paidAt, totalAmount, principalPart, interestPart, note: input.note },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId,
        kind: "LOAN_PAYMENT",
        status: "DONE",
        amount: totalAmount,
        currencyCode: loan.currencyCode,
        occurredAt: paidAt,
        name: `Платёж по кредиту: ${loan.name}`,
        note: input.note,
        loanId,
        loanPaymentId: payment.id,
      },
    });

    return { payment, transactionId: transaction.id };
  });
}
