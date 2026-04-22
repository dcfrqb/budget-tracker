import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { err, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { transferCreateSchema } from "@/lib/validation/transfer";

export const dynamic = "force-dynamic";

const TRANSFER_INCLUDE = {
  fromAccount: true,
  toAccount: true,
  transactions: { orderBy: { createdAt: "asc" as const } },
};

export async function GET() {
  try {
    const items = await db.transfer.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { occurredAt: "desc" },
      include: TRANSFER_INCLUDE,
    });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req, transferCreateSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  if (input.fromAccountId === input.toAccountId) {
    return err("fromAccountId and toAccountId must differ", 400);
  }

  try {
    const [from, to] = await Promise.all([
      db.account.findFirst({
        where: {
          id: input.fromAccountId,
          userId: DEFAULT_USER_ID,
          deletedAt: null,
          isArchived: false,
        },
        select: { id: true, currencyCode: true, name: true },
      }),
      db.account.findFirst({
        where: {
          id: input.toAccountId,
          userId: DEFAULT_USER_ID,
          deletedAt: null,
          isArchived: false,
        },
        select: { id: true, currencyCode: true, name: true },
      }),
    ]);
    if (!from) return err("fromAccount not found or archived", 400);
    if (!to) return err("toAccount not found or archived", 400);

    const sameCcy = from.currencyCode === to.currencyCode;
    let rate = input.rate;
    if (rate === undefined) {
      if (sameCcy) rate = "1";
      else return err("rate is required for cross-currency transfer", 400);
    }

    const name = `Перевод · ${from.name} → ${to.name}`;

    const created = await db.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          userId: DEFAULT_USER_ID,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          fromAmount: input.fromAmount,
          toAmount: input.toAmount,
          fromCcy: from.currencyCode,
          toCcy: to.currencyCode,
          rate: rate as string | Prisma.Decimal,
          fee: input.fee ?? null,
          occurredAt: input.occurredAt,
          note: input.note ?? null,
        },
      });
      await tx.transaction.createMany({
        data: [
          {
            userId: DEFAULT_USER_ID,
            accountId: input.fromAccountId,
            kind: TransactionKind.TRANSFER,
            status: TransactionStatus.DONE,
            amount: input.fromAmount,
            currencyCode: from.currencyCode,
            occurredAt: input.occurredAt,
            name,
            transferId: transfer.id,
          },
          {
            userId: DEFAULT_USER_ID,
            accountId: input.toAccountId,
            kind: TransactionKind.TRANSFER,
            status: TransactionStatus.DONE,
            amount: input.toAmount,
            currencyCode: to.currencyCode,
            occurredAt: input.occurredAt,
            name,
            transferId: transfer.id,
          },
        ],
      });
      return tx.transfer.findUniqueOrThrow({
        where: { id: transfer.id },
        include: TRANSFER_INCLUDE,
      });
    });

    return ok(created, 201);
  } catch (e) {
    return serverError(e);
  }
}
