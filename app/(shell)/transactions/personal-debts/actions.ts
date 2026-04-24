"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  debtCreateSchema,
  debtUpdateSchema,
  debtPaymentCreateSchema,
} from "@/lib/validation/debt";
import {
  createPersonalDebt,
  updatePersonalDebt,
  deletePersonalDebt,
  createDebtPayment,
  closePersonalDebt,
  reopenPersonalDebt,
} from "@/lib/data/_mutations/personal-debts";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createPersonalDebtAction = withUserAction(
  debtCreateSchema,
  async (userId, input) => {
    const debt = await createPersonalDebt(userId, input);
    revalidateTag("personal-debts", "default");
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return debt;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updatePersonalDebtAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = debtUpdateSchema.safeParse(rawData);
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
    const debt = await updatePersonalDebt(userId, id, parsed.data);
    revalidateTag("personal-debts", "default");
    revalidatePath("/", "layout");
    return actionOk(debt);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

export async function deletePersonalDebtAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deletePersonalDebt(userId, id);
    revalidateTag("personal-debts", "default");
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Create Payment
// ─────────────────────────────────────────────────────────────

export async function createDebtPaymentAction(debtId: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = debtPaymentCreateSchema.safeParse(rawData);
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
    const result = await createDebtPayment(userId, debtId, parsed.data);
    revalidateTag("personal-debts", "default");
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Close / Reopen
// ─────────────────────────────────────────────────────────────

export async function closePersonalDebtAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const debt = await closePersonalDebt(userId, id);
    revalidateTag("personal-debts", "default");
    revalidatePath("/", "layout");
    return actionOk(debt);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function reopenPersonalDebtAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const debt = await reopenPersonalDebt(userId, id);
    revalidateTag("personal-debts", "default");
    revalidatePath("/", "layout");
    return actionOk(debt);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}
