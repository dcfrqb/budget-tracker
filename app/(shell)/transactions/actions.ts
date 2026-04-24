"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionConfirmSchema,
  transactionOneLinerSchema,
} from "@/lib/validation/transaction";
import { z } from "zod";
import { zCuid } from "@/lib/validation/shared";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  confirmTransaction,
  cancelTransaction,
  missTransaction,
} from "@/lib/data/_mutations/transactions";
import {
  createReimbursement,
  reimbursementCreateSchema,
} from "@/lib/data/_mutations/reimbursements";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createTransactionAction = withUserAction(
  transactionCreateSchema,
  async (userId, input) => {
    const tx = await createTransaction(userId, input);
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return tx;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

const updateSchema = z.object({ id: zCuid, data: transactionUpdateSchema });

export async function updateTransactionAction(
  id: string,
  rawData: unknown,
) {
  const userId = await getCurrentUserId();
  const parsed = transactionUpdateSchema.safeParse(rawData);
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
    const tx = await updateTransaction(userId, id, parsed.data);
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk(tx);
  } catch {
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

export async function deleteTransactionAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    await deleteTransaction(userId, id);
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk({ id });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Confirm
// ─────────────────────────────────────────────────────────────

export async function confirmTransactionAction(
  id: string,
  rawData: unknown,
) {
  const userId = await getCurrentUserId();
  const parsed = transactionConfirmSchema.safeParse(rawData);
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
    const tx = await confirmTransaction(userId, id, parsed.data);
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk(tx);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Miss
// ─────────────────────────────────────────────────────────────

export async function missTransactionAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const tx = await missTransaction(userId, id);
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk(tx);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────────────────────

export async function cancelTransactionAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const tx = await cancelTransaction(userId, id);
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk(tx);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Reimbursement
// ─────────────────────────────────────────────────────────────

export async function createReimbursementAction(
  transactionId: string,
  rawData: unknown,
) {
  const userId = await getCurrentUserId();
  const parsed = reimbursementCreateSchema.safeParse(rawData);
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
    const fact = await createReimbursement(userId, transactionId, parsed.data);
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk(fact);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// One-liner quick-input action
// ─────────────────────────────────────────────────────────────

export const createTransactionFromOneLinerAction = withUserAction(
  transactionOneLinerSchema,
  async (userId, input) => {
    const tx = await createTransaction(userId, {
      ...input,
      status: "DONE",
    });
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return tx;
  },
);

// Suppress unused import warning for updateSchema
void updateSchema;
