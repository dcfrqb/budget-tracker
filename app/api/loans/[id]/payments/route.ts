import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, err, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { loanPaymentCreateSchema } from "@/lib/validation/loan";
import { getLoanById } from "@/lib/data/loans";
import { computeAmortization } from "@/lib/amortization";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const loan = await getLoanById(userId, id);
    if (!loan) return notFound("loan not found");

    const body = await parseBody(req, loanPaymentCreateSchema);
    if (!body.ok) return body.response;
    const input = body.data;

    const paidAt = input.paidAt ?? new Date();
    const totalAmount = new Prisma.Decimal(input.totalAmount);

    // Определяем accountId: из input или из loan.accountId
    const accountId = input.accountId ?? loan.accountId;
    if (!accountId) {
      return err("account_id_required", 422);
    }

    // Проверяем что account существует и принадлежит юзеру
    const account = await db.account.findFirst({
      where: { id: accountId, userId, deletedAt: null, isArchived: false },
      select: { id: true },
    });
    if (!account) return err("account not found or archived", 400);

    // Вычисляем principalPart и interestPart
    let principalPart: Prisma.Decimal;
    let interestPart: Prisma.Decimal;

    if (input.principalPart != null && input.interestPart != null) {
      principalPart = new Prisma.Decimal(input.principalPart);
      interestPart = new Prisma.Decimal(input.interestPart);
    } else {
      // Автосплит из графика: находим строку следующего неоплаченного n
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
        // Излишек над плановым → в principal
        const plannedPrincipal = scheduledRow.principalPart;
        const excess = totalAmount.minus(scheduledRow.payment);
        principalPart = excess.gt(0)
          ? plannedPrincipal.plus(excess)
          : plannedPrincipal;
        // Корректируем interestPart если total < planned
        if (totalAmount.lt(scheduledRow.payment)) {
          interestPart = totalAmount.minus(principalPart);
          if (interestPart.lt(0)) {
            interestPart = new Prisma.Decimal(0);
            principalPart = totalAmount;
          }
        }
      } else {
        // Выходим за пределы графика: всё в principal
        principalPart = totalAmount;
        interestPart = new Prisma.Decimal(0);
      }
    }

    // Создаём LoanPayment + Transaction атомарно
    const result = await db.$transaction(async (tx) => {
      const payment = await tx.loanPayment.create({
        data: {
          loanId: id,
          paidAt,
          totalAmount,
          principalPart,
          interestPart,
          note: input.note,
        },
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
          loanId: id,
          loanPaymentId: payment.id,
        },
      });

      return { payment, transactionId: transaction.id };
    });

    return ok(result, 201);
  } catch (e) {
    return serverError(e);
  }
}
