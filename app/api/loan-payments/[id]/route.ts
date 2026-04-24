import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { z } from "zod";
import { zMoney, zIsoDate } from "@/lib/validation/shared";

export const dynamic = "force-dynamic";

const paymentUpdateSchema = z.object({
  paidAt: zIsoDate.optional(),
  totalAmount: zMoney.optional(),
  principalPart: zMoney.optional(),
  interestPart: zMoney.optional(),
  note: z.string().max(500).nullish(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;

    // Проверяем что payment принадлежит кредиту юзера
    const payment = await db.loanPayment.findFirst({
      where: { id },
      include: { loan: { select: { userId: true } } },
    });
    if (!payment || payment.loan.userId !== userId) {
      return notFound("loan payment not found");
    }

    const body = await parseBody(req, paymentUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.loanPayment.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// Hard delete LoanPayment + soft-delete связанных Transaction'ов
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;

    const payment = await db.loanPayment.findFirst({
      where: { id },
      include: {
        loan: { select: { userId: true } },
        transactions: { select: { id: true } },
      },
    });
    if (!payment || payment.loan.userId !== userId) {
      return notFound("loan payment not found");
    }

    await db.$transaction(async (tx) => {
      // Soft-delete связанных транзакций
      if (payment.transactions.length > 0) {
        await tx.transaction.updateMany({
          where: { id: { in: payment.transactions.map((t) => t.id) } },
          data: { deletedAt: new Date() },
        });
      }
      // Hard delete самого платежа
      await tx.loanPayment.delete({ where: { id } });
    });

    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
