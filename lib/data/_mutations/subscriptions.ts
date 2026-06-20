import { db } from "@/lib/db";
import { TransactionKind } from "@prisma/client";
import type {
  SubscriptionCreateInput,
  SubscriptionUpdateInput,
  SubscriptionPayInput,
} from "@/lib/validation/subscription";
import {
  learnAliasFromTransaction,
  advanceNextPaymentDate,
} from "@/lib/data/_mutations/subscription-pairing";

// ─────────────────────────────────────────────────────────────
// Subscription mutations
// Note: paySubscription previously lived in lib/data/subscriptions.ts
// and is now the canonical location here.
// ─────────────────────────────────────────────────────────────

const SUB_INCLUDE = { shares: true, currency: true };

async function findSub(userId: string, id: string) {
  return db.subscription.findFirst({
    where: { id, userId, deletedAt: null },
    include: SUB_INCLUDE,
  });
}

export async function createSubscription(
  userId: string,
  input: SubscriptionCreateInput,
) {
  return db.subscription.create({
    data: { ...input, userId },
    include: SUB_INCLUDE,
  });
}

export async function updateSubscription(
  userId: string,
  id: string,
  input: SubscriptionUpdateInput,
) {
  const existing = await findSub(userId, id);
  if (!existing) throw Object.assign(new Error("subscription not found"), { code: "NOT_FOUND" });

  return db.subscription.update({
    where: { id },
    data: input,
    include: SUB_INCLUDE,
  });
}

export async function deleteSubscription(userId: string, id: string) {
  const existing = await findSub(userId, id);
  if (!existing) throw Object.assign(new Error("subscription not found"), { code: "NOT_FOUND" });

  await db.subscription.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
}

// ─────────────────────────────────────────────────────────────
// markSubscriptionPaid — links an existing txn or just advances date
// Does NOT create phantom expenses (use paySubscription for cash).
// ─────────────────────────────────────────────────────────────

export async function markSubscriptionPaid(
  userId: string,
  id: string,
  input: { paidAt?: Date; transactionId?: string | null },
) {
  const sub = await db.subscription.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!sub) throw Object.assign(new Error("subscription not found"), { code: "NOT_FOUND" });

  if (input.transactionId) {
    const txn = await db.transaction.findFirst({
      where: { id: input.transactionId, userId, deletedAt: null },
    });
    if (!txn) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });
    if (txn.kind !== TransactionKind.EXPENSE)
      throw Object.assign(new Error("transaction must be an EXPENSE"), { code: "INVALID" });
    if (txn.subscriptionId !== null)
      throw Object.assign(new Error("transaction already linked to a subscription"), { code: "CONFLICT" });

    return db.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: txn.id },
        data: { subscriptionId: id, subscriptionLinkSource: "manual" },
      });

      await learnAliasFromTransaction(tx, id, txn.name);

      const newNext = advanceNextPaymentDate(
        sub.nextPaymentDate,
        sub.billingIntervalMonths,
        txn.occurredAt,
      );

      return tx.subscription.update({
        where: { id },
        data: newNext > sub.nextPaymentDate ? { nextPaymentDate: newNext } : {},
        include: { shares: true, currency: true },
      });
    });
  }

  // No transactionId — just advance nextPaymentDate
  const paidAt = input.paidAt ?? new Date();
  const newNext = advanceNextPaymentDate(sub.nextPaymentDate, sub.billingIntervalMonths, paidAt);

  return db.subscription.update({
    where: { id },
    data: newNext > sub.nextPaymentDate ? { nextPaymentDate: newNext } : {},
    include: { shares: true, currency: true },
  });
}

// ─────────────────────────────────────────────────────────────
// unlinkSubscriptionTransaction
// ─────────────────────────────────────────────────────────────

export async function unlinkSubscriptionTransaction(
  userId: string,
  transactionId: string,
  opts?: { rollbackNextPaymentDate?: boolean },
) {
  const txn = await db.transaction.findFirst({
    where: { id: transactionId, userId, deletedAt: null },
    include: { subscription: true },
  });
  if (!txn) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });
  if (!txn.subscriptionId || !txn.subscription)
    throw Object.assign(new Error("transaction is not linked to a subscription"), { code: "INVALID" });
  if (txn.subscription.userId !== userId)
    throw Object.assign(new Error("subscription not found"), { code: "NOT_FOUND" });

  const sub = txn.subscription;

  return db.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transactionId },
      data: { subscriptionId: null, subscriptionLinkSource: "unlinked" },
    });

    if (opts?.rollbackNextPaymentDate) {
      // Check if this is the most-recent linked charge for that sub
      const mostRecent = await tx.transaction.findFirst({
        where: {
          subscriptionId: sub.id,
          deletedAt: null,
          id: { not: transactionId },
        },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      });

      const isMostRecent =
        !mostRecent || txn.occurredAt >= mostRecent.occurredAt;

      if (isMostRecent) {
        const rolledBack = new Date(sub.nextPaymentDate);
        rolledBack.setMonth(rolledBack.getMonth() - sub.billingIntervalMonths);
        await tx.subscription.update({
          where: { id: sub.id },
          data: { nextPaymentDate: rolledBack },
        });
      }
    }

    return { transactionId };
  });
}

export async function paySubscription(
  userId: string,
  subscriptionId: string,
  input: SubscriptionPayInput,
) {
  const sub = await db.subscription.findFirst({
    where: { id: subscriptionId, userId, deletedAt: null },
  });
  if (!sub) throw Object.assign(new Error("subscription not found"), { code: "NOT_FOUND" });

  const paidAt = input.paidAt ?? new Date();

  const nextDate = new Date(sub.nextPaymentDate);
  nextDate.setMonth(nextDate.getMonth() + sub.billingIntervalMonths);

  return db.$transaction(async (tx) => {
    const accountId = input.accountId;
    if (!accountId) throw Object.assign(new Error("accountId is required"), { code: "INVALID" });

    const account = await tx.account.findFirst({
      where: { id: accountId, userId, deletedAt: null, isArchived: false },
      select: { id: true },
    });
    if (!account) throw Object.assign(new Error("account_not_found_or_archived"), { code: "NOT_FOUND" });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId,
        categoryId: input.categoryId ?? null,
        kind: "EXPENSE",
        status: "DONE",
        amount: sub.price,
        currencyCode: sub.currencyCode,
        occurredAt: paidAt,
        name: sub.name,
        note: input.note,
        subscriptionId: sub.id,
      },
    });

    const updated = await tx.subscription.update({
      where: { id: subscriptionId },
      data: { nextPaymentDate: nextDate },
    });

    return { subscription: updated, transactionId: transaction.id };
  });
}
