import { db } from "@/lib/db";
import { getWorkSourceById } from "@/lib/data/work-sources";
import type {
  WorkSourceCreateInput,
  WorkSourceUpdateInput,
} from "@/lib/validation/work-source";

// ─────────────────────────────────────────────────────────────
// WorkSource mutations
// ─────────────────────────────────────────────────────────────

export async function createWorkSource(userId: string, input: WorkSourceCreateInput) {
  return db.workSource.create({
    data: { ...input, userId },
  });
}

export async function updateWorkSource(
  userId: string,
  id: string,
  input: WorkSourceUpdateInput,
) {
  const existing = await getWorkSourceById(userId, id);
  if (!existing) throw Object.assign(new Error("work source not found"), { code: "NOT_FOUND" });

  return db.workSource.update({ where: { id }, data: input });
}

// Soft deactivate
export async function deactivateWorkSource(userId: string, id: string) {
  const existing = await getWorkSourceById(userId, id);
  if (!existing) throw Object.assign(new Error("work source not found"), { code: "NOT_FOUND" });

  await db.workSource.update({ where: { id }, data: { isActive: false } });
  return { id };
}
