import { Prisma, FreelanceOrderStageStatus, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  StageCreateInput,
  StageUpdateInput,
  StageMarkPaidInput,
  StageAttachTxnInput,
  StageUnmarkInput,
  StageDeleteInput,
} from "@/lib/validation/freelance-order-stage";

function notFound(): never {
  throw Object.assign(new Error("stage not found"), { code: "NOT_FOUND" });
}

async function findStage(userId: string, stageId: string) {
  const stage = await db.freelanceOrderStage.findFirst({
    where: { id: stageId, userId },
    include: { order: true },
  });
  if (!stage) notFound();
  return stage;
}

export async function createStage(userId: string, input: StageCreateInput) {
  const order = await db.freelanceOrder.findFirst({
    where: { id: input.freelanceOrderId, userId },
    select: { id: true },
  });
  if (!order) throw Object.assign(new Error("order not found"), { code: "NOT_FOUND" });

  const maxSort = await db.freelanceOrderStage.findFirst({
    where: { freelanceOrderId: input.freelanceOrderId, userId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return db.freelanceOrderStage.create({
    data: {
      userId,
      freelanceOrderId: input.freelanceOrderId,
      currencyCode: (
        await db.freelanceOrder.findFirst({
          where: { id: input.freelanceOrderId },
          select: { currencyCode: true },
        })
      )!.currencyCode,
      label: input.label,
      expectedAmount: new Prisma.Decimal(input.expectedAmount),
      dueDate: input.dueDate ?? null,
      sortOrder: input.sortOrder ?? (maxSort ? maxSort.sortOrder + 1 : 0),
      status: FreelanceOrderStageStatus.PENDING,
    },
  });
}

export async function updateStage(userId: string, stageId: string, input: StageUpdateInput) {
  await findStage(userId, stageId);

  return db.freelanceOrderStage.update({
    where: { id: stageId },
    data: {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.expectedAmount !== undefined && input.expectedAmount !== null && {
        expectedAmount: new Prisma.Decimal(input.expectedAmount),
      }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate ?? null }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
  });
}

export async function deleteStage(userId: string, input: StageDeleteInput) {
  await findStage(userId, input.stageId);
  await db.freelanceOrderStage.delete({ where: { id: input.stageId } });
  return { id: input.stageId };
}

export async function markStagePaid(userId: string, input: StageMarkPaidInput) {
  const stage = await findStage(userId, input.stageId);

  const account = await db.account.findFirst({
    where: { id: input.accountId, userId, deletedAt: null, isArchived: false },
    select: { id: true },
  });
  if (!account) throw Object.assign(new Error("account not found or archived"), { code: "NOT_FOUND" });

  const paidAt = input.paidAt ?? new Date();
  const paidAmount = input.paidAmount
    ? new Prisma.Decimal(input.paidAmount)
    : new Prisma.Decimal(stage.expectedAmount);

  return db.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        kind: TransactionKind.INCOME,
        status: TransactionStatus.DONE,
        amount: paidAmount,
        currencyCode: stage.currencyCode,
        occurredAt: paidAt,
        name: stage.label,
        note: input.note ?? null,
        freelanceOrderId: stage.freelanceOrderId,
        workSourceId: stage.order.workSourceId,
      },
    });

    const updatedStage = await tx.freelanceOrderStage.update({
      where: { id: input.stageId },
      data: {
        status: FreelanceOrderStageStatus.PAID,
        paidAt,
        paidAmount,
        transactionId: transaction.id,
      },
    });

    return { stage: updatedStage, transactionId: transaction.id };
  });
}

export async function attachTxnToStage(userId: string, input: StageAttachTxnInput) {
  const stage = await findStage(userId, input.stageId);

  const txn = await db.transaction.findFirst({
    where: { id: input.txnId, userId, deletedAt: null, kind: TransactionKind.INCOME },
    select: { id: true, amount: true, status: true, facts: { select: { amount: true } } },
  });
  if (!txn) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });

  const effectiveAmount =
    txn.status === TransactionStatus.DONE
      ? new Prisma.Decimal(txn.amount)
      : txn.facts.reduce((s, f) => s.plus(f.amount), new Prisma.Decimal(0));

  return db.freelanceOrderStage.update({
    where: { id: stage.id },
    data: {
      status: FreelanceOrderStageStatus.PAID,
      paidAt: new Date(),
      paidAmount: effectiveAmount,
      transactionId: input.txnId,
    },
  });
}

export async function unmarkStage(userId: string, input: StageUnmarkInput) {
  const stage = await findStage(userId, input.stageId);
  const linkedTxnId = stage.transactionId;

  // markStagePaid auto-creates the linked income transaction, so unmarking must
  // delete it — otherwise unmark+re-mark would leave an orphaned txn and double
  // the recorded income. The transactions feed shows only non-deleted txns, so a
  // hard delete here is the correct inverse of the auto-create.
  // NOTE: when the (deferred) "attach existing txn" UI lands, those user-owned txns
  // must NOT be deleted on unmark — they need a discriminator flag added at that point.
  return db.$transaction(async (tx) => {
    const updatedStage = await tx.freelanceOrderStage.update({
      where: { id: input.stageId },
      data: {
        status: FreelanceOrderStageStatus.PENDING,
        paidAt: null,
        paidAmount: null,
        transactionId: null,
      },
    });

    if (linkedTxnId) {
      await tx.transaction.delete({ where: { id: linkedTxnId } });
    }

    return updatedStage;
  });
}
