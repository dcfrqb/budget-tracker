import { db } from "@/lib/db";
import type {
  AccountCreateInput,
  AccountUpdateInput,
} from "@/lib/validation/account";

// ─────────────────────────────────────────────────────────────
// Account mutations
// ─────────────────────────────────────────────────────────────

export async function createAccount(userId: string, input: AccountCreateInput) {
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

  return db.account.update({ where: { id }, data: input });
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
