"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  fundCreateSchema,
  fundUpdateSchema,
} from "@/lib/validation/fund";
import { fundContributionSchema } from "@/lib/validation/fund-contribution";
import {
  createFund,
  updateFund,
  deleteFund,
  contributeFund,
} from "@/lib/data/_mutations/funds";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createFundAction = withUserAction(
  fundCreateSchema,
  async (userId, input) => {
    const fund = await createFund(userId, input);
    revalidateTag("funds", "default");
    revalidatePath("/", "layout");
    return fund;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateFundAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = fundUpdateSchema.safeParse(rawData);
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
    const fund = await updateFund(userId, id, parsed.data);
    revalidateTag("funds", "default");
    revalidatePath("/", "layout");
    return actionOk(fund);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

export async function deleteFundAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deleteFund(userId, id);
    revalidateTag("funds", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Contribute
// ─────────────────────────────────────────────────────────────

export async function contributeFundAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = fundContributionSchema.safeParse(rawData);
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
    const result = await contributeFund(userId, id, parsed.data);
    revalidateTag("funds", "default");
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
