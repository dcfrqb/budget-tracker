"use server";

import { GroupKind, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { getPrimaryCurrency } from "@/lib/data/settings";
import { getLatestRatesMap } from "@/lib/data/wallet";
import {
  pickMainAndNetto,
  pickMergeMain,
  INFLOW_KINDS,
  OUTFLOW_KINDS,
} from "@/lib/data/_shared/compensation-projection";
import {
  createCompensationSchema,
  createMergeSchema,
  breakCompensationSchema,
} from "@/lib/validation/compensations";
import { revalidatePath } from "next/cache";

type CreateResult =
  | { ok: true; groupId: string }
  | { ok: false; error: string };

type BreakResult = { ok: true } | { ok: false; error: string };

const ALLOWED_STATUSES: TransactionStatus[] = [
  TransactionStatus.DONE,
  TransactionStatus.PARTIAL,
];

export async function createCompensationGroup(args: {
  txnIds: string[];
}): Promise<CreateResult> {
  const userId = await getCurrentUserId();

  // 1. Zod parse
  const parsed = createCompensationSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, error: "transactions.compensation.error.too_few" };
  }
  const { txnIds } = parsed.data;

  // 2. Fetch txns, verify ownership + soft-delete + no transfer/compensation already
  const txns = await db.transaction.findMany({
    where: { id: { in: txnIds }, userId, deletedAt: null },
    select: {
      id: true,
      kind: true,
      status: true,
      amount: true,
      currencyCode: true,
      categoryId: true,
      transferId: true,
      compensationGroupId: true,
      scope: true,
      familyId: true,
    },
  });

  if (txns.length !== txnIds.length) {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }

  if (txns.some((t) => t.transferId !== null)) {
    return { ok: false, error: "transactions.selection.tooltip.already_transfer" };
  }

  if (txns.some((t) => t.compensationGroupId !== null)) {
    return { ok: false, error: "transactions.selection.tooltip.already_grouped" };
  }

  // 3. Status check: only DONE + PARTIAL
  if (txns.some((t) => !ALLOWED_STATUSES.includes(t.status))) {
    return { ok: false, error: "transactions.compensation.error.bad_status" };
  }

  // 4. Scope/familyId uniformity
  const scopes = new Set(txns.map((t) => t.scope));
  const familyIds = new Set(txns.map((t) => t.familyId ?? "__null__"));
  if (scopes.size > 1 || familyIds.size > 1) {
    return { ok: false, error: "transactions.compensation.error.scope_mismatch" };
  }

  // 5. Mixed kinds check
  const hasExpense = txns.some((t) => t.kind === "EXPENSE");
  const hasIncome = txns.some((t) => t.kind === "INCOME");
  if (!hasExpense || !hasIncome) {
    return { ok: false, error: "transactions.compensation.error.same_kind_only" };
  }

  // 6. FX rates + baseCcy
  const [rates, baseCcy] = await Promise.all([
    getLatestRatesMap(),
    getPrimaryCurrency(userId),
  ]);

  // 7. pickMainAndNetto
  let mainResult: ReturnType<typeof pickMainAndNetto>;
  try {
    mainResult = pickMainAndNetto(txns, rates, baseCcy);
  } catch (err) {
    if (err instanceof Error && err.message === "fx_rate_missing") {
      return { ok: false, error: "transactions.compensation.error.fx_rate_missing" };
    }
    return { ok: false, error: "transactions.compensation.error.same_kind_only" };
  }

  const { mainTxnId, nettoBase, nettoSign, categoryIdForAggregation } = mainResult;

  // 8. Get main txn occurredAt for the group
  const mainTxn = txns.find((t) => t.id === mainTxnId)!;

  // We need occurredAt from DB
  const mainTxnFull = await db.transaction.findUniqueOrThrow({
    where: { id: mainTxnId },
    select: { occurredAt: true },
  });

  // 9. DB transaction: create group + link all members
  let groupId: string;
  try {
    const group = await db.$transaction(async (tx) => {
      const created = await tx.compensationGroup.create({
        data: {
          userId,
          mainTxnId,
          nettoBase,
          nettoSign,
          baseCcy,
          categoryIdForAggregation: categoryIdForAggregation ?? null,
          occurredAt: mainTxnFull.occurredAt,
        },
      });
      await tx.transaction.updateMany({
        where: { id: { in: txnIds } },
        data: { compensationGroupId: created.id },
      });
      return created;
    });
    groupId = group.id;
  } catch {
    return { ok: false, error: "transactions.selection.error.compensation_failed" };
  }

  revalidatePath("/transactions");
  revalidatePath("/", "layout");
  return { ok: true, groupId };
}

export async function createMergeGroup(args: {
  txnIds: string[];
}): Promise<CreateResult> {
  const userId = await getCurrentUserId();

  const parsed = createMergeSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, error: "transactions.compensation.error.too_few" };
  }
  const { txnIds } = parsed.data;

  const txns = await db.transaction.findMany({
    where: { id: { in: txnIds }, userId, deletedAt: null },
    select: {
      id: true,
      kind: true,
      status: true,
      amount: true,
      currencyCode: true,
      categoryId: true,
      transferId: true,
      compensationGroupId: true,
      scope: true,
      familyId: true,
    },
  });

  if (txns.length !== txnIds.length) {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }

  if (txns.some((t) => t.transferId !== null)) {
    return { ok: false, error: "transactions.selection.tooltip.already_transfer" };
  }

  if (txns.some((t) => t.compensationGroupId !== null)) {
    return { ok: false, error: "transactions.selection.tooltip.already_grouped" };
  }

  if (txns.some((t) => !ALLOWED_STATUSES.includes(t.status))) {
    return { ok: false, error: "transactions.compensation.error.bad_status" };
  }

  const scopes = new Set(txns.map((t) => t.scope));
  const familyIds = new Set(txns.map((t) => t.familyId ?? "__null__"));
  if (scopes.size > 1 || familyIds.size > 1) {
    return { ok: false, error: "transactions.compensation.error.scope_mismatch" };
  }

  // MERGE requires all same direction (all inflow or all outflow).
  const allInflow = txns.every((t) => INFLOW_KINDS.includes(t.kind));
  const allOutflow = txns.every((t) => OUTFLOW_KINDS.includes(t.kind));
  if (!allInflow && !allOutflow) {
    return { ok: false, error: "transactions.merge.error.need_same_sign" };
  }

  const [rates, baseCcy] = await Promise.all([
    getLatestRatesMap(),
    getPrimaryCurrency(userId),
  ]);

  let mainResult: ReturnType<typeof pickMergeMain>;
  try {
    mainResult = pickMergeMain(txns, rates, baseCcy);
  } catch (err) {
    if (err instanceof Error && err.message === "fx_rate_missing") {
      return { ok: false, error: "transactions.compensation.error.fx_rate_missing" };
    }
    return { ok: false, error: "transactions.merge.error.need_same_sign" };
  }

  const { mainTxnId, nettoBase, nettoSign } = mainResult;

  const mainTxnFull = await db.transaction.findUniqueOrThrow({
    where: { id: mainTxnId },
    select: { occurredAt: true },
  });

  let groupId: string;
  try {
    const group = await db.$transaction(async (tx) => {
      const created = await tx.compensationGroup.create({
        data: {
          userId,
          mainTxnId,
          nettoBase,
          nettoSign,
          baseCcy,
          categoryIdForAggregation: null,
          occurredAt: mainTxnFull.occurredAt,
          kind: GroupKind.MERGE,
        },
      });
      await tx.transaction.updateMany({
        where: { id: { in: txnIds } },
        data: { compensationGroupId: created.id },
      });
      return created;
    });
    groupId = group.id;
  } catch {
    return { ok: false, error: "transactions.merge.error.failed" };
  }

  revalidatePath("/transactions");
  revalidatePath("/", "layout");
  return { ok: true, groupId };
}

export async function breakCompensationGroup(args: {
  groupId: string;
}): Promise<BreakResult> {
  const userId = await getCurrentUserId();

  // 1. Zod parse
  const parsed = breakCompensationSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }
  const { groupId } = parsed.data;

  // 2. Verify ownership
  const group = await db.compensationGroup.findFirst({
    where: { id: groupId, userId },
    select: { id: true },
  });
  if (!group) {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }

  // 3. DB transaction: unlink members + delete group
  try {
    await db.$transaction(async (tx) => {
      await tx.transaction.updateMany({
        where: { compensationGroupId: groupId },
        data: { compensationGroupId: null },
      });
      await tx.compensationGroup.delete({ where: { id: groupId } });
    });
  } catch {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }

  revalidatePath("/transactions");
  revalidatePath("/", "layout");
  return { ok: true };
}
