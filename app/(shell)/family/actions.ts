"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import { familyCreateSchema, familyUpdateSchema } from "@/lib/validation/family";
import {
  familyMemberCreateSchema,
  familyMemberUpdateSchema,
} from "@/lib/validation/family-member";
import {
  createFamily,
  updateFamily,
  deleteFamily,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
} from "@/lib/data/_mutations/families";

// ─────────────────────────────────────────────────────────────
// Family CRUD
// ─────────────────────────────────────────────────────────────

export const createFamilyAction = withUserAction(
  familyCreateSchema,
  async (userId, input) => {
    const family = await createFamily(userId, input);
    revalidateTag("family", "default");
    revalidatePath("/", "layout");
    return family;
  },
);

export async function updateFamilyAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = familyUpdateSchema.safeParse(rawData);
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
    const family = await updateFamily(userId, id, parsed.data);
    revalidateTag("family", "default");
    revalidatePath("/", "layout");
    return actionOk(family);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function deleteFamilyAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deleteFamily(userId, id);
    revalidateTag("family", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Family Member CRUD
// ─────────────────────────────────────────────────────────────

export async function addFamilyMemberAction(familyId: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = familyMemberCreateSchema.safeParse(rawData);
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
    const member = await addFamilyMember(userId, familyId, parsed.data);
    revalidateTag("family", "default");
    revalidatePath("/", "layout");
    return actionOk(member);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function updateFamilyMemberAction(memberId: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = familyMemberUpdateSchema.safeParse(rawData);
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
    const member = await updateFamilyMember(userId, memberId, parsed.data);
    revalidateTag("family", "default");
    revalidatePath("/", "layout");
    return actionOk(member);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function removeFamilyMemberAction(memberId: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await removeFamilyMember(userId, memberId);
    revalidateTag("family", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}
