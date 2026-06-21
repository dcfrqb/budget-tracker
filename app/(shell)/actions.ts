"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/api/auth";
import { dismissSignal } from "@/lib/data/_mutations/signals";

const dismissSignalSchema = z.object({
  signalKey: z.string().min(1).max(120),
});

export async function dismissSignalAction(rawData: unknown): Promise<void> {
  const parsed = dismissSignalSchema.safeParse(rawData);
  if (!parsed.success) throw new Error("Invalid input");

  const userId = await getCurrentUserId();
  await dismissSignal(userId, parsed.data.signalKey, 7);
  revalidatePath("/", "layout");
}
