"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  loanCreateSchema,
  loanUpdateSchema,
  loanPaymentCreateSchema,
} from "@/lib/validation/loan";
import {
  createLoan,
  updateLoan,
  deleteLoan,
  createLoanPayment,
} from "@/lib/data/_mutations/loans";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createLoanAction = withUserAction(
  loanCreateSchema,
  async (userId, input) => {
    const loan = await createLoan(userId, input);
    revalidateTag("loans", "default");
    revalidatePath("/", "layout");
    return loan;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateLoanAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = loanUpdateSchema.safeParse(rawData);
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
    const loan = await updateLoan(userId, id, parsed.data);
    revalidateTag("loans", "default");
    revalidatePath("/", "layout");
    return actionOk(loan);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

export async function deleteLoanAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deleteLoan(userId, id);
    revalidateTag("loans", "default");
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
// Create Loan Payment
// ─────────────────────────────────────────────────────────────

export async function createLoanPaymentAction(loanId: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = loanPaymentCreateSchema.safeParse(rawData);
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
    const result = await createLoanPayment(userId, loanId, parsed.data);
    revalidateTag("loans", "default");
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "INVALID") return actionError("conflict");
    return actionError("internal_error");
  }
}
