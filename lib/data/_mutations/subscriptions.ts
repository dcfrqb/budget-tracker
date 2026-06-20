import { db } from "@/lib/db";
import { Prisma, TransactionKind } from "@prisma/client";
import type {
  SubscriptionCreateInput,
  SubscriptionUpdateInput,
  SubscriptionPayInput,
  SubscriptionFromTransactionsInput,
  LinkTransactionsToSubscriptionInput,
} from "@/lib/validation/subscription";
import {
  learnAliasFromTransaction,
  advanceNextPaymentDate,
} from "@/lib/data/_mutations/subscription-pairing";
import { normalizeMerchant } from "@/lib/integrations/merchant";

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

// ─────────────────────────────────────────────────────────────
// createSubscriptionFromTransactions
// ─────────────────────────────────────────────────────────────

export async function createSubscriptionFromTransactions(
  userId: string,
  input: SubscriptionFromTransactionsInput,
): Promise<{ subscriptionId: string; linkedCount: number }> {
  const { name, transactionIds, isVariablePrice, currencyCode, billingIntervalMonths, categoryId, sharingType } = input;

  const txns = await db.transaction.findMany({
    where: { id: { in: transactionIds }, userId, deletedAt: null },
    select: { id: true, kind: true, subscriptionId: true, amount: true, currencyCode: true, occurredAt: true, name: true },
  });

  if (txns.length !== transactionIds.length) {
    throw Object.assign(new Error("one or more transactions not found"), { code: "NOT_FOUND" });
  }
  for (const txn of txns) {
    if (txn.kind !== TransactionKind.EXPENSE) {
      throw Object.assign(new Error("all transactions must be EXPENSE"), { code: "INVALID" });
    }
    if (txn.subscriptionId !== null) {
      throw Object.assign(new Error("transaction already linked to a subscription"), { code: "CONFLICT" });
    }
  }

  // Price: use latest charge matching the target currency, or latest overall
  const sorted = [...txns].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const latestMatching = sorted.find((t) => t.currencyCode === currencyCode);
  const priceTxn = latestMatching ?? sorted[0];
  const price = new Prisma.Decimal(priceTxn.amount).abs();

  // nextPaymentDate: latest charge occurredAt + billingIntervalMonths
  const latestOccurredAt = sorted[0].occurredAt;
  const nextPaymentDate = new Date(latestOccurredAt);
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + billingIntervalMonths);

  // matchKeywords: most frequent normalized name across selected txns
  const nameFreq = new Map<string, number>();
  for (const txn of txns) {
    const key = normalizeMerchant(txn.name);
    if (key) nameFreq.set(key, (nameFreq.get(key) ?? 0) + 1);
  }
  const topKey = [...nameFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const matchKeywords = topKey ? [topKey] : [];

  return db.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        userId,
        name,
        price,
        currencyCode,
        billingIntervalMonths,
        nextPaymentDate,
        sharingType,
        isVariablePrice: isVariablePrice ?? false,
        autoMatch: true,
        matchKeywords,
        ...(categoryId ? { categoryId } : {}),
      },
    });

    await tx.transaction.updateMany({
      where: { id: { in: transactionIds } },
      data: { subscriptionId: sub.id, subscriptionLinkSource: "manual" },
    });

    return { subscriptionId: sub.id, linkedCount: transactionIds.length };
  });
}

// ─────────────────────────────────────────────────────────────
// linkTransactionsToSubscription
// ─────────────────────────────────────────────────────────────

export async function linkTransactionsToSubscription(
  userId: string,
  input: LinkTransactionsToSubscriptionInput,
): Promise<{ subscriptionId: string; linkedCount: number }> {
  const { subscriptionId, transactionIds } = input;

  const sub = await db.subscription.findFirst({
    where: { id: subscriptionId, userId, deletedAt: null },
  });
  if (!sub) throw Object.assign(new Error("subscription not found"), { code: "NOT_FOUND" });

  const txns = await db.transaction.findMany({
    where: { id: { in: transactionIds }, userId, deletedAt: null },
    select: { id: true, kind: true, subscriptionId: true, occurredAt: true, name: true },
  });

  if (txns.length !== transactionIds.length) {
    throw Object.assign(new Error("one or more transactions not found"), { code: "NOT_FOUND" });
  }
  for (const txn of txns) {
    if (txn.kind !== TransactionKind.EXPENSE) {
      throw Object.assign(new Error("all transactions must be EXPENSE"), { code: "INVALID" });
    }
    if (txn.subscriptionId !== null) {
      throw Object.assign(new Error("transaction already linked to a subscription"), { code: "CONFLICT" });
    }
  }

  // Most common normalized name across selected txns
  const nameFreq = new Map<string, string>(); // normalizedKey → original name
  const nameCount = new Map<string, number>();
  for (const txn of txns) {
    const key = normalizeMerchant(txn.name);
    if (key) {
      nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
      if (!nameFreq.has(key)) nameFreq.set(key, txn.name);
    }
  }
  const topKey = [...nameCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topOriginalName = topKey ? (nameFreq.get(topKey) ?? "") : "";

  // Latest occurredAt among selected txns (for nextPaymentDate advance)
  const latestOccurredAt = txns.reduce(
    (max, t) => (t.occurredAt > max ? t.occurredAt : max),
    txns[0].occurredAt,
  );

  return db.$transaction(async (tx) => {
    await tx.transaction.updateMany({
      where: { id: { in: transactionIds } },
      data: { subscriptionId, subscriptionLinkSource: "manual" },
    });

    if (topOriginalName) {
      await learnAliasFromTransaction(tx, subscriptionId, topOriginalName);
    }

    // Advance nextPaymentDate only if latest linked charge is newer than current nextPaymentDate
    const newNext = advanceNextPaymentDate(sub.nextPaymentDate, sub.billingIntervalMonths, latestOccurredAt);
    if (newNext > sub.nextPaymentDate) {
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { nextPaymentDate: newNext },
      });
    }

    return { subscriptionId, linkedCount: transactionIds.length };
  });
}

// ─────────────────────────────────────────────────────────────
// mergeSubscriptions
// ─────────────────────────────────────────────────────────────

export async function mergeSubscriptions(
  userId: string,
  keepId: string,
  mergeId: string,
): Promise<{ keepId: string; movedCount: number }> {
  if (keepId === mergeId) {
    throw Object.assign(new Error("keepId and mergeId must differ"), { code: "CONFLICT" });
  }

  const [keep, merge] = await Promise.all([
    db.subscription.findFirst({ where: { id: keepId, userId, deletedAt: null } }),
    db.subscription.findFirst({ where: { id: mergeId, userId, deletedAt: null } }),
  ]);

  if (!keep) throw Object.assign(new Error("keep subscription not found"), { code: "NOT_FOUND" });
  if (!merge) throw Object.assign(new Error("merge subscription not found"), { code: "NOT_FOUND" });

  return db.$transaction(async (tx) => {
    const [keepInTx, mergeInTx] = await Promise.all([
      tx.subscription.findUnique({ where: { id: keepId }, select: { matchKeywords: true } }),
      tx.subscription.findUnique({ where: { id: mergeId }, select: { matchKeywords: true } }),
    ]);

    const unionKeywords = [
      ...new Set([
        ...(keepInTx?.matchKeywords ?? []),
        ...(mergeInTx?.matchKeywords ?? []),
      ]),
    ];

    const { count: movedCount } = await tx.transaction.updateMany({
      where: { subscriptionId: mergeId, userId },
      data: { subscriptionId: keepId },
    });

    await tx.subscription.update({
      where: { id: keepId, userId },
      data: { matchKeywords: unionKeywords },
    });

    await tx.subscription.update({
      where: { id: mergeId, userId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await tx.subscriptionDuplicateDismissal.deleteMany({
      where: {
        userId,
        OR: [{ subAId: mergeId }, { subBId: mergeId }],
      },
    });

    return { keepId, movedCount };
  });
}

// ─────────────────────────────────────────────────────────────
// dismissDuplicatePair
// ─────────────────────────────────────────────────────────────

export async function dismissDuplicatePair(
  userId: string,
  idA: string,
  idB: string,
): Promise<void> {
  const [subA, subB] = await Promise.all([
    db.subscription.findFirst({ where: { id: idA, userId, deletedAt: null } }),
    db.subscription.findFirst({ where: { id: idB, userId, deletedAt: null } }),
  ]);

  if (!subA) throw Object.assign(new Error("subscription A not found"), { code: "NOT_FOUND" });
  if (!subB) throw Object.assign(new Error("subscription B not found"), { code: "NOT_FOUND" });

  const [subAId, subBId] = idA < idB ? [idA, idB] : [idB, idA];

  await db.subscriptionDuplicateDismissal.upsert({
    where: { userId_subAId_subBId: { userId, subAId, subBId } },
    create: { userId, subAId, subBId },
    update: {},
  });
}
