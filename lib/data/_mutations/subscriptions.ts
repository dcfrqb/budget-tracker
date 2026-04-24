import { db } from "@/lib/db";
import type {
  SubscriptionCreateInput,
  SubscriptionUpdateInput,
  SubscriptionPayInput,
} from "@/lib/validation/subscription";

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
