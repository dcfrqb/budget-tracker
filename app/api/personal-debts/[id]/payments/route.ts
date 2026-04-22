import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, err, notFound, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { debtPaymentCreateSchema, dbDirectionToApi } from "@/lib/validation/debt";
import {
  computeDebtProgress,
  returnKindFor,
} from "@/lib/data/debts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, debtPaymentCreateSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const debt = await db.personalDebt.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      include: { currency: true },
    });
    if (!debt) return notFound("personal debt not found");
    if (debt.closedAt) return conflict("debt is closed — reopen before adding payments");

    const acc = await db.account.findFirst({
      where: {
        id: input.accountId,
        userId: DEFAULT_USER_ID,
        deletedAt: null,
        isArchived: false,
      },
      select: { id: true, name: true },
    });
    if (!acc) return err("account not found or archived", 400);

    const result = await db.$transaction(async (tx) => {
      const payment = await tx.transaction.create({
        data: {
          userId: DEFAULT_USER_ID,
          accountId: input.accountId,
          kind: returnKindFor(debt.direction),
          status: input.status,
          amount: input.amount,
          currencyCode: debt.currencyCode,
          occurredAt: input.occurredAt,
          plannedAt: input.status === "PLANNED" ? input.occurredAt : null,
          name: `Возврат · ${debt.counterparty}`,
          note: input.note ?? null,
          personalDebtId: debt.id,
        },
      });

      // Пересчитываем прогресс и закрываем если нужно.
      const fresh = await tx.personalDebt.findUniqueOrThrow({
        where: { id: debt.id },
        include: {
          currency: true,
          transactions: {
            where: { deletedAt: null },
            include: { facts: true },
          },
        },
      });
      const prog = computeDebtProgress(fresh);
      let closed = fresh;
      if (prog.remainingAmount.isZero() && !fresh.closedAt) {
        closed = await tx.personalDebt.update({
          where: { id: debt.id },
          data: { closedAt: new Date() },
          include: {
            currency: true,
            transactions: {
              where: { deletedAt: null },
              include: { facts: true },
            },
          },
        });
      }
      return { payment, closed };
    });

    const withProgress = { ...result.closed, ...computeDebtProgress(result.closed) };
    return ok(
      {
        debt: { ...withProgress, direction: dbDirectionToApi(withProgress.direction) },
        payment: result.payment,
      },
      201,
    );
  } catch (e) {
    return serverError(e);
  }
}
