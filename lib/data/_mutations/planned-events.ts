import { db } from "@/lib/db";
import { getPlannedEventById } from "@/lib/data/planned-events";
import type {
  PlannedEventCreateInput,
  PlannedEventUpdateInput,
} from "@/lib/validation/planned-event";

// ─────────────────────────────────────────────────────────────
// PlannedEvent mutations
// ─────────────────────────────────────────────────────────────

export async function createPlannedEvent(
  userId: string,
  input: PlannedEventCreateInput,
) {
  return db.plannedEvent.create({
    data: { ...input, userId },
  });
}

export async function updatePlannedEvent(
  userId: string,
  id: string,
  input: PlannedEventUpdateInput,
) {
  const existing = await getPlannedEventById(userId, id);
  if (!existing) throw Object.assign(new Error("planned event not found"), { code: "NOT_FOUND" });

  return db.plannedEvent.update({ where: { id }, data: input });
}

export async function deletePlannedEvent(userId: string, id: string) {
  const existing = await getPlannedEventById(userId, id);
  if (!existing) throw Object.assign(new Error("planned event not found"), { code: "NOT_FOUND" });

  await db.plannedEvent.delete({ where: { id } });
  return { id };
}
