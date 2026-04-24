import { db } from "@/lib/db";
import { getLongProjectById } from "@/lib/data/long-projects";
import type {
  LongProjectCreateInput,
  LongProjectUpdateInput,
} from "@/lib/validation/long-project";

// ─────────────────────────────────────────────────────────────
// LongProject mutations
// ─────────────────────────────────────────────────────────────

export async function createLongProject(
  userId: string,
  input: LongProjectCreateInput,
) {
  return db.longProject.create({
    data: { ...input, userId },
  });
}

export async function updateLongProject(
  userId: string,
  id: string,
  input: LongProjectUpdateInput,
) {
  const existing = await getLongProjectById(userId, id);
  if (!existing)
    throw Object.assign(new Error("long project not found"), { code: "NOT_FOUND" });

  return db.longProject.update({ where: { id }, data: input });
}

export async function deleteLongProject(userId: string, id: string) {
  const existing = await getLongProjectById(userId, id);
  if (!existing)
    throw Object.assign(new Error("long project not found"), { code: "NOT_FOUND" });
  if (existing._count.transactions > 0) {
    throw Object.assign(
      new Error("cannot delete project with existing transactions"),
      { code: "CONFLICT" },
    );
  }

  await db.longProject.delete({ where: { id } });
  return { id };
}
