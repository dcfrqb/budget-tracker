import { Prisma, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, err, notFound, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { dbDirectionToApi, debtUpdateSchema } from "@/lib/validation/debt";
import {
  computeDebtProgress,
  getPersonalDebtWithProgress,
} from "@/lib/data/debts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const d = await getPersonalDebtWithProgress(DEFAULT_USER_ID, id);
    if (!d) return notFound("personal debt not found");
    return ok({ ...d, direction: dbDirectionToApi(d.direction) });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, debtUpdateSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const existing = await getPersonalDebtWithProgress(DEFAULT_USER_ID, id);
    if (!existing) return notFound("personal debt not found");

    if (input.principal !== undefined) {
      const newPrincipal = new Prisma.Decimal(input.principal);
      if (newPrincipal.lt(existing.returnedAmount)) {
        return conflict(
          `principal cannot be less than already returned ${existing.returnedAmount.toString()}`,
        );
      }
    }

    const updated = await db.personalDebt.update({
      where: { id },
      data: {
        ...(input.counterparty !== undefined ? { counterparty: input.counterparty } : {}),
        ...(input.principal !== undefined ? { principal: input.principal } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
    return ok({ ...updated, direction: dbDirectionToApi(updated.direction) });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const existing = await db.personalDebt.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      include: {
        transactions: {
          where: {
            deletedAt: null,
            status: { not: TransactionStatus.CANCELLED },
          },
          select: { id: true },
        },
      },
    });
    if (!existing) return notFound("personal debt not found");
    if (existing.transactions.length > 0) {
      return conflict(
        "personal debt has active transactions — cancel or delete them first",
      );
    }

    await db.personalDebt.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverError(e);
  }
}
