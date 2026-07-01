"use server";

import { revalidatePath } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  businessCreateSchema,
  businessUpdateSchema,
  businessAllocationCreateSchema,
  businessAllocationUpdateSchema,
} from "@/lib/validation/business";
import {
  createBusiness,
  updateBusiness,
  deactivateBusiness,
  activateBusiness,
  createBusinessAllocation,
  updateBusinessAllocation,
  deleteBusinessAllocation,
} from "@/lib/data/_mutations/businesses";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createBusinessAction = withUserAction(
  businessCreateSchema,
  async (userId, input) => {
    const biz = await createBusiness(userId, input);
    revalidatePath("/business", "layout");
    revalidatePath("/", "layout");
    return biz;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateBusinessAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = businessUpdateSchema.safeParse(rawData);
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
    const biz = await updateBusiness(userId, id, parsed.data);
    revalidatePath("/business", "layout");
    revalidatePath("/", "layout");
    return actionOk(biz);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CURRENCY_LOCKED") return actionError("currency_locked");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Deactivate / Activate
// ─────────────────────────────────────────────────────────────

export async function deactivateBusinessAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deactivateBusiness(userId, id);
    revalidatePath("/business", "layout");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function activateBusinessAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await activateBusiness(userId, id);
    revalidatePath("/business", "layout");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// BusinessAllocation
// ─────────────────────────────────────────────────────────────

export async function createBusinessAllocationAction(rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = businessAllocationCreateSchema.safeParse(rawData);
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
    const allocation = await createBusinessAllocation(userId, parsed.data);
    revalidatePath("/business", "layout");
    revalidatePath("/", "layout");
    return actionOk(allocation);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "OVER_ALLOCATED") return actionError("over_allocated");
    return actionError("internal_error");
  }
}

export async function updateBusinessAllocationAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = businessAllocationUpdateSchema.safeParse(rawData);
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
    const allocation = await updateBusinessAllocation(userId, id, parsed.data);
    revalidatePath("/business", "layout");
    revalidatePath("/", "layout");
    return actionOk(allocation);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "OVER_ALLOCATED") return actionError("over_allocated");
    return actionError("internal_error");
  }
}

export async function deleteBusinessAllocationAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deleteBusinessAllocation(userId, id);
    revalidatePath("/business", "layout");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}
