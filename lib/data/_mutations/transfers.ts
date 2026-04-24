import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  TransferCreateInput,
  TransferUpdateInput,
} from "@/lib/validation/transfer";

// ─────────────────────────────────────────────────────────────
// Transfer mutations
// ─────────────────────────────────────────────────────────────

const TRANSFER_INCLUDE = {
  fromAccount: true,
  toAccount: true,
  transactions: { orderBy: { createdAt: "asc" as const } },
};

export async function createTransfer(userId: string, input: TransferCreateInput) {
  if (input.fromAccountId === input.toAccountId) {
    throw Object.assign(new Error("fromAccountId and toAccountId must differ"), { code: "INVALID" });
  }

  const [from, to] = await Promise.all([
    db.account.findFirst({
      where: { id: input.fromAccountId, userId, deletedAt: null, isArchived: false },
      select: { id: true, currencyCode: true, name: true },
    }),
    db.account.findFirst({
      where: { id: input.toAccountId, userId, deletedAt: null, isArchived: false },
      select: { id: true, currencyCode: true, name: true },
    }),
  ]);
  if (!from) throw Object.assign(new Error("fromAccount not found or archived"), { code: "NOT_FOUND" });
  if (!to) throw Object.assign(new Error("toAccount not found or archived"), { code: "NOT_FOUND" });

  const sameCcy = from.currencyCode === to.currencyCode;
  let rate = input.rate;
  if (rate === undefined) {
    if (sameCcy) rate = "1";
    else throw Object.assign(new Error("rate is required for cross-currency transfer"), { code: "INVALID" });
  }

  const name = `Перевод · ${from.name} → ${to.name}`;

  return db.$transaction(async (tx) => {
    const transfer = await tx.transfer.create({
      data: {
        userId,
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
          userId,
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
          userId,
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
}

export async function updateTransfer(
  userId: string,
  id: string,
  input: TransferUpdateInput,
) {
  const existing = await db.transfer.findFirst({
    where: { id, userId },
  });
  if (!existing) throw Object.assign(new Error("transfer not found"), { code: "NOT_FOUND" });

  const fromAccountId = input.fromAccountId ?? existing.fromAccountId;
  const toAccountId = input.toAccountId ?? existing.toAccountId;
  if (fromAccountId === toAccountId) {
    throw Object.assign(new Error("fromAccountId and toAccountId must differ"), { code: "INVALID" });
  }

  const [from, to] = await Promise.all([
    db.account.findFirst({
      where: { id: fromAccountId, userId, deletedAt: null, isArchived: false },
      select: { id: true, currencyCode: true, name: true },
    }),
    db.account.findFirst({
      where: { id: toAccountId, userId, deletedAt: null, isArchived: false },
      select: { id: true, currencyCode: true, name: true },
    }),
  ]);
  if (!from) throw Object.assign(new Error("fromAccount not found or archived"), { code: "NOT_FOUND" });
  if (!to) throw Object.assign(new Error("toAccount not found or archived"), { code: "NOT_FOUND" });

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

  return db.$transaction(async (tx) => {
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

    const sides = await tx.transaction.findMany({
      where: { transferId: id, kind: TransactionKind.TRANSFER },
      orderBy: { createdAt: "asc" },
    });
    if (sides.length >= 1) {
      await tx.transaction.update({
        where: { id: sides[0].id },
        data: { accountId: fromAccountId, amount: fromAmount, currencyCode: fromCcy, occurredAt, name },
      });
    }
    if (sides.length >= 2) {
      await tx.transaction.update({
        where: { id: sides[1].id },
        data: { accountId: toAccountId, amount: toAmount, currencyCode: toCcy, occurredAt, name },
      });
    }

    return tx.transfer.findUniqueOrThrow({
      where: { id },
      include: TRANSFER_INCLUDE,
    });
  });
}

export async function deleteTransfer(userId: string, id: string) {
  const existing = await db.transfer.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw Object.assign(new Error("transfer not found"), { code: "NOT_FOUND" });

  await db.$transaction([
    db.transaction.updateMany({
      where: { transferId: id },
      data: { deletedAt: new Date() },
    }),
    db.transfer.delete({ where: { id } }),
  ]);
}
