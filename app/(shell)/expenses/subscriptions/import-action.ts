"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/api/auth";
import { subscriptionCreateSchema } from "@/lib/validation/subscription";
import { createSubscription } from "@/lib/data/_mutations/subscriptions";

export type ImportRowError = { index: number; message: string };

export type ImportResult =
  | { ok: true; created: number; errors: ImportRowError[] }
  | { ok: false; parseError: true };

export async function importSubscriptionsAction(jsonString: string): Promise<ImportResult> {
  const userId = await getCurrentUserId();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { ok: false, parseError: true };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, parseError: true };
  }

  let created = 0;
  const errors: ImportRowError[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    const result = subscriptionCreateSchema.safeParse(row);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join("; ");
      errors.push({ index: i, message });
      continue;
    }
    try {
      await createSubscription(userId, result.data);
      created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      errors.push({ index: i, message });
    }
  }

  if (created > 0) {
    revalidatePath("/expenses/subscriptions");
  }

  return { ok: true, created, errors };
}
