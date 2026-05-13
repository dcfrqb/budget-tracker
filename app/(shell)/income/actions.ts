"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  workSourceCreateSchema,
  workSourceUpdateSchema,
} from "@/lib/validation/work-source";
import {
  createWorkSource,
  updateWorkSource,
  deactivateWorkSource,
  activateWorkSource,
} from "@/lib/data/_mutations/work-sources";
import {
  freelanceOrderCreateSchema,
  freelanceOrderUpdateSchema,
  linkTxnToOrderSchema,
  unlinkTxnFromOrderSchema,
} from "@/lib/validation/freelance-order";
import {
  createFreelanceOrder,
  updateFreelanceOrder,
  deleteFreelanceOrder,
} from "@/lib/data/_mutations/freelance-orders";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createWorkSourceAction = withUserAction(
  workSourceCreateSchema,
  async (userId, input) => {
    const ws = await createWorkSource(userId, input);
    revalidateTag("work-sources", "default");
    revalidatePath("/", "layout");
    return ws;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateWorkSourceAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = workSourceUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { ok: false as const, fieldErrors };
  }
  try {
    const ws = await updateWorkSource(userId, id, parsed.data);
    revalidateTag("work-sources", "default");
    revalidatePath("/", "layout");
    return actionOk(ws);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CURRENCY_LOCKED") return actionError("currency_locked");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Deactivate
// ─────────────────────────────────────────────────────────────

export async function deactivateWorkSourceAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deactivateWorkSource(userId, id);
    revalidateTag("work-sources", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function activateWorkSourceAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await activateWorkSource(userId, id);
    revalidateTag("work-sources", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// FreelanceOrder — Create
// ─────────────────────────────────────────────────────────────

export const createFreelanceOrderAction = withUserAction(
  freelanceOrderCreateSchema,
  async (userId, input) => {
    const order = await createFreelanceOrder(userId, input);
    revalidateTag("work-sources", "default");
    revalidatePath("/", "layout");
    return order;
  },
);

// ─────────────────────────────────────────────────────────────
// FreelanceOrder — Update
// ─────────────────────────────────────────────────────────────

export async function updateFreelanceOrderAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = freelanceOrderUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { ok: false as const, fieldErrors };
  }
  try {
    const order = await updateFreelanceOrder(userId, id, parsed.data);
    revalidateTag("work-sources", "default");
    revalidatePath("/", "layout");
    return actionOk(order);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// FreelanceOrder — Delete
// ─────────────────────────────────────────────────────────────

export async function deleteFreelanceOrderAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deleteFreelanceOrder(userId, id);
    revalidateTag("work-sources", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// FreelanceOrder — Link / Unlink Transaction
// ─────────────────────────────────────────────────────────────

export async function linkTxnToFreelanceOrderAction(rawInput: unknown) {
  const userId = await getCurrentUserId();
  const parsed = linkTxnToOrderSchema.safeParse(rawInput);
  if (!parsed.success) return actionError("validation_error");

  const { orderId, txnId } = parsed.data;

  const [txn, order] = await Promise.all([
    db.transaction.findFirst({ where: { id: txnId, userId, deletedAt: null } }),
    db.freelanceOrder.findFirst({ where: { id: orderId, userId } }),
  ]);

  if (!txn || !order) return actionError("not_found");

  // Require explicit workSourceId match: transaction must already belong to the same
  // source as the order. Don't auto-assign — keeps link/unlink symmetric (unlinking
  // would otherwise need to remember whether workSourceId was implicitly set).
  if (txn.workSourceId !== order.workSourceId) {
    return actionError("validation_error");
  }

  await db.transaction.update({
    where: { id: txnId },
    data: { freelanceOrderId: orderId },
  });

  revalidatePath(`/income/work-sources/${order.workSourceId}`, "page");
  revalidatePath(`/income/work-sources/${order.workSourceId}/edit`, "page");
  return actionOk(true);
}

export async function unlinkTxnFromFreelanceOrderAction(rawInput: unknown) {
  const userId = await getCurrentUserId();
  const parsed = unlinkTxnFromOrderSchema.safeParse(rawInput);
  if (!parsed.success) return actionError("validation_error");

  const { txnId } = parsed.data;

  const txn = await db.transaction.findFirst({ where: { id: txnId, userId, deletedAt: null } });
  if (!txn) return actionError("not_found");

  const workSourceId = txn.workSourceId;

  await db.transaction.update({
    where: { id: txnId },
    data: { freelanceOrderId: null },
  });

  if (workSourceId) {
    revalidatePath(`/income/work-sources/${workSourceId}`, "page");
    revalidatePath(`/income/work-sources/${workSourceId}/edit`, "page");
  }
  return actionOk(true);
}
