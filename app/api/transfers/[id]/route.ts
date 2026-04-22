import { Prisma, TransactionKind } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { err, notFound, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { transferUpdateSchema } from "@/lib/validation/transfer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const TRANSFER_INCLUDE = {
  fromAccount: true,
  toAccount: true,
  transactions: { orderBy: { createdAt: "asc" as const } },
};

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const t = await db.transfer.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      include: TRANSFER_INCLUDE,
    });
    if (!t) return notFound("transfer not found");
    return ok(t);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, transferUpdateSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const existing = await db.transfer.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!existing) return notFound("transfer not found");

    const fromAccountId = input.fromAccountId ?? existing.fromAccountId;
    const toAccountId = input.toAccountId ?? existing.toAccountId;
    if (fromAccountId === toAccountId) {
      return err("fromAccountId and toAccountId must differ", 400);
    }

    const [from, to] = await Promise.all([
      db.account.findFirst({
        where: {
          id: fromAccountId,
          userId: DEFAULT_USER_ID,
          deletedAt: null,
          isArchived: false,
        },
        select: { id: true, currencyCode: true, name: true },
      }),
      db.account.findFirst({
        where: {
          id: toAccountId,
          userId: DEFAULT_USER_ID,
          deletedAt: null,
          isArchived: false,
        },
        select: { id: true, currencyCode: true, name: true },
      }),
    ]);
    if (!from) return err("fromAccount not found or archived", 400);
    if (!to) return err("toAccount not found or archived", 400);

    const fromAmount = input.fromAmount ?? existing.fromAmount;
    const toAmount = input.toAmount ?? existing.toAmount;
    const occurredAt = input.occurredAt ?? existing.occurredAt;
    const fromCcy = from.currencyCode;
    const toCcy = to.currencyCode;

    let rate: Prisma.Decimal | string;
    if (input.rate !== undefined) {
      rate = input.rate;
    } else if (fromCcy === toCcy) {
      rate = "1";
    } else {
      rate = existing.rate;
    }

    const name = `Перевод · ${from.name} → ${to.name}`;

    const updated = await db.$transaction(async (tx) => {
      await tx.transfer.update({
        where: { id },
        data: {
          fromAccountId,
          toAccountId,
          fromAmount,
          toAmount,
          fromCcy,
          toCcy,
          rate,
          fee: input.fee === undefined ? existing.fee : input.fee,
          occurredAt,
          note: input.note === undefined ? existing.note : input.note,
        },
      });

      // Синхронизируем обе стороны Transaction. Берём самую раннюю как
      // from-сторону (createdAt asc).
      const sides = await tx.transaction.findMany({
        where: { transferId: id, kind: TransactionKind.TRANSFER },
        orderBy: { createdAt: "asc" },
      });
      if (sides.length >= 1) {
        await tx.transaction.update({
          where: { id: sides[0].id },
          data: {
            accountId: fromAccountId,
            amount: fromAmount,
            currencyCode: fromCcy,
            occurredAt,
            name,
          },
        });
      }
      if (sides.length >= 2) {
        await tx.transaction.update({
          where: { id: sides[1].id },
          data: {
            accountId: toAccountId,
            amount: toAmount,
            currencyCode: toCcy,
            occurredAt,
            name,
          },
        });
      }

      return tx.transfer.findUniqueOrThrow({
        where: { id },
        include: TRANSFER_INCLUDE,
      });
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const existing = await db.transfer.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      select: { id: true },
    });
    if (!existing) return notFound("transfer not found");

    await db.$transaction([
      db.transaction.updateMany({
        where: { transferId: id },
        data: { deletedAt: new Date() },
      }),
      db.transfer.delete({ where: { id } }),
    ]);
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverError(e);
  }
}
