"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  longProjectCreateSchema,
  longProjectUpdateSchema,
} from "@/lib/validation/long-project";
import {
  createLongProject,
  updateLongProject,
  deleteLongProject,
} from "@/lib/data/_mutations/long-projects";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createLongProjectAction = withUserAction(
  longProjectCreateSchema,
  async (userId, input) => {
    const project = await createLongProject(userId, input);
    revalidateTag("long-projects", "default");
    revalidatePath("/", "layout");
    return project;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateLongProjectAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = longProjectUpdateSchema.safeParse(rawData);
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
    const project = await updateLongProject(userId, id, parsed.data);
    revalidateTag("long-projects", "default");
    revalidatePath("/", "layout");
    return actionOk(project);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

export async function deleteLongProjectAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deleteLongProject(userId, id);
    revalidateTag("long-projects", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}
