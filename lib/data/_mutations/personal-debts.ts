import { Prisma, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getPersonalDebtWithProgress,
  initialKindFor,
  returnKindFor,
} from "@/lib/data/debts";
import { apiDirectionToDb } from "@/lib/validation/debt";
import type {
  DebtCreateInput,
  DebtUpdateInput,
  DebtPaymentCreateInput,
} from "@/lib/validation/debt";

// ─────────────────────────────────────────────────────────────
// PersonalDebt mutations
// ─────────────────────────────────────────────────────────────

export async function createPersonalDebt(
  userId: string,
  input: DebtCreateInput,
) {
  const direction = apiDirectionToDb(input.direction);

  return db.$transaction(async (tx) => {
    const debt = await tx.personalDebt.create({
      data: {
        userId,
        direction,
        counterparty: input.counterparty,
        principal: input.principal,
        currencyCode: input.currencyCode,
        openedAt: input.openedAt,
        dueAt: input.dueAt ?? null,
        note: input.note ?? null,
      },
    });

    if (input.initialTransfer?.accountId) {
      const account = await tx.account.findFirst({
        where: { id: input.initialTransfer.accountId, userId, deletedAt: null, isArchived: false },
        select: { id: true },
      });
      if (!account) throw Object.assign(new Error("account_not_found_or_archived"), { code: "NOT_FOUND" });

      const kind = initialKindFor(direction);
      await tx.transaction.create({
        data: {
          userId,
          accountId: input.initialTransfer.accountId,
          kind,
          status: TransactionStatus.DONE,
          amount: input.principal,
          currencyCode: input.currencyCode,
          occurredAt: input.initialTransfer.occurredAt ?? input.openedAt,
          name: `${direction === "LENT" ? "Выдал в долг" : "Взял в долг"}: ${input.counterparty}`,
          personalDebtId: debt.id,
        },
      });
    }

    return debt;
  });
}

export async function updatePersonalDebt(
  userId: string,
  id: string,
  input: DebtUpdateInput,
) {
  const existing = await db.personalDebt.findFirst({ where: { id, userId } });
  if (!existing)
    throw Object.assign(new Error("personal debt not found"), { code: "NOT_FOUND" });

  const data: Prisma.PersonalDebtUpdateInput = {};
  if (input.counterparty !== undefined) data.counterparty = input.counterparty;
  if (input.principal !== undefined) data.principal = input.principal;
  if (input.dueAt !== undefined) data.dueAt = input.dueAt ?? null;
  if (input.note !== undefined) data.note = input.note ?? null;

  return db.personalDebt.update({ where: { id }, data });
}

export async function deletePersonalDebt(userId: string, id: string) {
  const existing = await db.personalDebt.findFirst({
    where: { id, userId },
    include: { _count: { select: { transactions: true } } },
  });
  if (!existing)
    throw Object.assign(new Error("personal debt not found"), { code: "NOT_FOUND" });
  if (existing._count.transactions > 0) {
    throw Object.assign(
      new Error("cannot delete debt with existing transactions"),
      { code: "CONFLICT" },
    );
  }

  await db.personalDebt.delete({ where: { id } });
  return { id };
}

export async function createDebtPayment(
  userId: string,
  debtId: string,
  input: DebtPaymentCreateInput,
) {
  const debt = await db.personalDebt.findFirst({ where: { id: debtId, userId } });
  if (!debt)
    throw Object.assign(new Error("personal debt not found"), { code: "NOT_FOUND" });
  if (debt.closedAt)
    throw Object.assign(new Error("debt is already closed"), { code: "CONFLICT" });

  const returnKind = returnKindFor(debt.direction);

  const account = await db.account.findFirst({
    where: { id: input.accountId, userId, deletedAt: null, isArchived: false },
    select: { id: true },
  });
  if (!account) throw Object.assign(new Error("account_not_found_or_archived"), { code: "NOT_FOUND" });

  const txn = await db.transaction.create({
    data: {
      userId,
      accountId: input.accountId,
      kind: returnKind,
      status: input.status ?? TransactionStatus.DONE,
      amount: input.amount,
      currencyCode: debt.currencyCode,
      occurredAt: input.occurredAt,
      name: `Возврат долга: ${debt.counterparty}`,
      note: input.note ?? null,
      personalDebtId: debtId,
    },
  });

  return txn;
}

export async function closePersonalDebt(userId: string, id: string) {
  const existing = await db.personalDebt.findFirst({ where: { id, userId } });
  if (!existing)
    throw Object.assign(new Error("personal debt not found"), { code: "NOT_FOUND" });

  return db.personalDebt.update({
    where: { id },
    data: { closedAt: new Date() },
  });
}

export async function reopenPersonalDebt(userId: string, id: string) {
  const existing = await db.personalDebt.findFirst({ where: { id, userId } });
  if (!existing)
    throw Object.assign(new Error("personal debt not found"), { code: "NOT_FOUND" });

  return db.personalDebt.update({
    where: { id },
    data: { closedAt: null },
  });
}
