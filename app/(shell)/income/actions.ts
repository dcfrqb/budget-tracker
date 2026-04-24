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
} from "@/lib/data/_mutations/work-sources";

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
