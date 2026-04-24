"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  plannedEventCreateSchema,
  plannedEventUpdateSchema,
} from "@/lib/validation/planned-event";
import {
  createPlannedEvent,
  updatePlannedEvent,
  deletePlannedEvent,
} from "@/lib/data/_mutations/planned-events";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createPlannedEventAction = withUserAction(
  plannedEventCreateSchema,
  async (userId, input) => {
    const event = await createPlannedEvent(userId, input);
    revalidateTag("planned-events", "default");
    revalidatePath("/", "layout");
    return event;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updatePlannedEventAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = plannedEventUpdateSchema.safeParse(rawData);
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
    const event = await updatePlannedEvent(userId, id, parsed.data);
    revalidateTag("planned-events", "default");
    revalidatePath("/", "layout");
    return actionOk(event);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

export async function deletePlannedEventAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deletePlannedEvent(userId, id);
    revalidateTag("planned-events", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}
