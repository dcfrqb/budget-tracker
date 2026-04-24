import { db } from "@/lib/db";
import { getCategoryById } from "@/lib/data/categories";
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
} from "@/lib/validation/category";

// ─────────────────────────────────────────────────────────────
// Category mutations
// ─────────────────────────────────────────────────────────────

export async function createCategory(userId: string, input: CategoryCreateInput) {
  return db.category.create({
    data: { ...input, userId },
  });
}

export async function updateCategory(
  userId: string,
  id: string,
  input: CategoryUpdateInput,
) {
  const existing = await getCategoryById(userId, id);
  if (!existing) throw Object.assign(new Error("category not found"), { code: "NOT_FOUND" });

  return db.category.update({ where: { id }, data: input });
}

export async function archiveCategory(userId: string, id: string) {
  const existing = await getCategoryById(userId, id);
  if (!existing) throw Object.assign(new Error("category not found"), { code: "NOT_FOUND" });
  if (existing.archivedAt) throw Object.assign(new Error("already archived"), { code: "CONFLICT" });

  await db.category.update({ where: { id }, data: { archivedAt: new Date() } });
  return { id };
}

export async function unarchiveCategory(userId: string, id: string) {
  const existing = await getCategoryById(userId, id);
  if (!existing) throw Object.assign(new Error("category not found"), { code: "NOT_FOUND" });
  if (!existing.archivedAt) throw Object.assign(new Error("not archived"), { code: "CONFLICT" });

  await db.category.update({ where: { id }, data: { archivedAt: null } });
  return { id };
}
