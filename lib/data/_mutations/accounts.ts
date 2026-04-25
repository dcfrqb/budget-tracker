import { db } from "@/lib/db";
import type {
  AccountCreateInput,
  AccountUpdateInput,
} from "@/lib/validation/account";

// ─────────────────────────────────────────────────────────────
// Account mutations
// ─────────────────────────────────────────────────────────────

export async function createAccount(userId: string, input: AccountCreateInput) {
  if (input.cardLast4 && input.cardLast4.length > 0) {
    const conflict = await db.account.findFirst({
      where: { userId, deletedAt: null, cardLast4: { hasSome: input.cardLast4 } },
      select: { id: true, cardLast4: true },
    });
    if (conflict) {
      const duplicates = (conflict.cardLast4 as string[]).filter((d) =>
        input.cardLast4!.includes(d),
      );
      throw Object.assign(new Error("card already bound to another account"), {
        code: "CARD_LAST4_CONFLICT",
        duplicates,
      });
    }
  }

  return db.account.create({
    data: { ...input, userId },
  });
}

export async function updateAccount(
  userId: string,
  id: string,
  input: AccountUpdateInput,
) {
  const existing = await db.account.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw Object.assign(new Error("account not found"), { code: "NOT_FOUND" });

  if (input.cardLast4 && input.cardLast4.length > 0) {
    const conflict = await db.account.findFirst({
      where: {
        userId,
        deletedAt: null,
        id: { not: id },
        cardLast4: { hasSome: input.cardLast4 },
      },
      select: { id: true, cardLast4: true },
    });
    if (conflict) {
      const duplicates = (conflict.cardLast4 as string[]).filter((d) =>
        input.cardLast4!.includes(d),
      );
      throw Object.assign(new Error("card already bound to another account"), {
        code: "CARD_LAST4_CONFLICT",
        duplicates,
      });
    }
  }

  const updateData: typeof input & { balanceUpdatedAt?: Date } = { ...input };
  if (input.balance !== undefined) {
    updateData.balanceUpdatedAt = new Date();
  }

  return db.account.update({ where: { id }, data: updateData });
}

export async function archiveAccount(userId: string, id: string) {
  const existing = await db.account.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, isArchived: true },
  });
  if (!existing) throw Object.assign(new Error("account not found"), { code: "NOT_FOUND" });

  return db.account.update({ where: { id }, data: { isArchived: true } });
}

export async function unarchiveAccount(userId: string, id: string) {
  const existing = await db.account.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw Object.assign(new Error("account not found"), { code: "NOT_FOUND" });

  return db.account.update({ where: { id }, data: { isArchived: false } });
}

export async function deleteAccount(userId: string, id: string) {
  const acc = await db.account.findFirst({
    where: { id, userId, deletedAt: null },
    select: {
      id: true,
      _count: {
        select: {
          transactions: true,
          transfersFrom: true,
          transfersTo: true,
        },
      },
    },
  });
  if (!acc) throw Object.assign(new Error("account not found"), { code: "NOT_FOUND" });

  const related =
    acc._count.transactions + acc._count.transfersFrom + acc._count.transfersTo;
  if (related > 0) {
    throw Object.assign(
      new Error("account has transactions/transfers — archive instead of delete"),
      { code: "CONFLICT" },
    );
  }

  await db.account.delete({ where: { id } });
}
