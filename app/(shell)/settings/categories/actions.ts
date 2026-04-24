"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
} from "@/lib/validation/category";
import {
  createCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
} from "@/lib/data/_mutations/categories";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createCategoryAction = withUserAction(
  categoryCreateSchema,
  async (userId, input) => {
    const cat = await createCategory(userId, input);
    revalidateTag("categories", "default");
    revalidatePath("/", "layout");
    return cat;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateCategoryAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = categoryUpdateSchema.safeParse(rawData);
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
    const cat = await updateCategory(userId, id, parsed.data);
    revalidateTag("categories", "default");
    revalidatePath("/", "layout");
    return actionOk(cat);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Archive / Unarchive
// ─────────────────────────────────────────────────────────────

export async function archiveCategoryAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await archiveCategory(userId, id);
    revalidateTag("categories", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

export async function unarchiveCategoryAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await unarchiveCategory(userId, id);
    revalidateTag("categories", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}
