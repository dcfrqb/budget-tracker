"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { ActionResult, actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  transferCreateSchema,
  transferUpdateSchema,
} from "@/lib/validation/transfer";
import {
  createTransfer,
  updateTransfer,
  deleteTransfer,
} from "@/lib/data/_mutations/transfers";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export async function createTransferAction(rawInput: unknown): Promise<ActionResult<unknown>> {
  const userId = await getCurrentUserId();
  const parsed = transferCreateSchema.safeParse(rawInput);
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
    const result = await createTransfer(userId, parsed.data);
    revalidateTag("transactions", "default");
    revalidateTag("accounts", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string; reason?: string };
    if (err.code === "INVALID") {
      if (err.reason === "SAME_ACCOUNT") return actionError("transfer_same_account");
      if (err.reason === "CURRENCY_MISMATCH") return actionError("transfer_currency_mismatch");
      return actionError("transfer_invalid");
    }
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateTransferAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = transferUpdateSchema.safeParse(rawData);
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
    const transfer = await updateTransfer(userId, id, parsed.data);
    revalidateTag("transactions", "default");
    revalidateTag("accounts", "default");
    revalidatePath("/", "layout");
    return actionOk(transfer);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

export async function deleteTransferAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    await deleteTransfer(userId, id);
    revalidateTag("transactions", "default");
    revalidateTag("accounts", "default");
    revalidatePath("/", "layout");
    return actionOk({ id });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}
