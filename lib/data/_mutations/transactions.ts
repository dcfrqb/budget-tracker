import {
  Prisma,
  TransactionKind,
  TransactionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import type {
  TransactionCreateInput,
  TransactionUpdateInput,
  TransactionConfirmInput,
} from "@/lib/validation/transaction";

// ─────────────────────────────────────────────────────────────
// Transaction mutations — pure data-access functions
// All callers (route-handlers, server-actions) use these.
// Input is already validated by the caller.
// ─────────────────────────────────────────────────────────────

export async function createTransaction(
  userId: string,
  input: TransactionCreateInput,
) {
  if (input.kind === TransactionKind.TRANSFER) {
    throw new Error("use createTransfer for TRANSFER kind");
  }

  // Verify account belongs to user and is active
  const acc = await db.account.findFirst({
    where: { id: input.accountId, userId, deletedAt: null, isArchived: false },
    select: { id: true },
  });
  if (!acc) throw Object.assign(new Error("account not found or archived"), { code: "NOT_FOUND" });

  if (input.categoryId) {
    const cat = await db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { id: true },
    });
    if (!cat) throw Object.assign(new Error("category not found"), { code: "NOT_FOUND" });
  }

  return db.transaction.create({
    data: { ...input, userId },
  });
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: TransactionUpdateInput,
) {
  const existing = await db.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, transferId: true },
  });
  if (!existing) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });
  if (existing.transferId) {
    throw Object.assign(
      new Error("transfer-side transaction — edit via transfers"),
      { code: "CONFLICT" },
    );
  }

  return db.transaction.update({ where: { id }, data: input });
}

export async function deleteTransaction(userId: string, id: string) {
  const existing = await db.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, transferId: true },
  });
  if (!existing) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });
  if (existing.transferId) {
    throw Object.assign(
      new Error("transfer-side transaction — delete via transfers"),
      { code: "CONFLICT" },
    );
  }

  await db.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function confirmTransaction(
  userId: string,
  id: string,
  input: TransactionConfirmInput,
) {
  const txn = await db.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    include: { facts: true },
  });
  if (!txn) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });

  if (
    txn.status !== TransactionStatus.PLANNED &&
    txn.status !== TransactionStatus.PARTIAL
  ) {
    throw Object.assign(
      new Error(`cannot confirm from status ${txn.status}`),
      { code: "CONFLICT" },
    );
  }

  const planned = new Prisma.Decimal(txn.amount);
  const already = txn.facts.reduce(
    (acc, f) => acc.plus(f.amount),
    new Prisma.Decimal(0),
  );
  const remaining = planned.minus(already);

  const factAmount =
    input.amount !== undefined
      ? new Prisma.Decimal(input.amount)
      : remaining;

  if (factAmount.lte(0)) throw Object.assign(new Error("amount must be positive"), { code: "INVALID" });
  if (factAmount.gt(remaining)) {
    throw Object.assign(
      new Error(`amount exceeds remaining ${remaining.toFixed(2)}`),
      { code: "INVALID" },
    );
  }

  const newTotal = already.plus(factAmount);
  const nextStatus = newTotal.gte(planned)
    ? TransactionStatus.DONE
    : TransactionStatus.PARTIAL;
  const factDate = input.occurredAt ?? new Date();

  const [, updated] = await db.$transaction([
    db.transactionFact.create({
      data: {
        transactionId: id,
        amount: factAmount,
        occurredAt: factDate,
        note: input.note ?? null,
      },
    }),
    db.transaction.update({
      where: { id },
      data: { status: nextStatus },
      include: { facts: { orderBy: { occurredAt: "desc" } } },
    }),
  ]);

  return updated;
}

export async function cancelTransaction(userId: string, id: string) {
  const txn = await db.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    select: { status: true },
  });
  if (!txn) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });
  if (txn.status === TransactionStatus.DONE) {
    throw Object.assign(new Error("cannot cancel a DONE transaction"), { code: "CONFLICT" });
  }

  return db.transaction.update({
    where: { id },
    data: { status: TransactionStatus.CANCELLED },
  });
}

export async function missTransaction(userId: string, id: string) {
  const txn = await db.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    select: { status: true },
  });
  if (!txn) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });
  if (txn.status !== TransactionStatus.PLANNED) {
    throw Object.assign(
      new Error(`cannot mark missed from status ${txn.status}`),
      { code: "CONFLICT" },
    );
  }

  return db.transaction.update({
    where: { id },
    data: { status: TransactionStatus.MISSED },
  });
}
