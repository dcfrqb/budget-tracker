import { db } from "@/lib/db";
import { WorkKind } from "@prisma/client";
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

  // Currency lock: if currencyCode is being changed, check for linked transactions
  if (input.currencyCode != null && input.currencyCode !== existing.currencyCode) {
    const linkedCount = await db.transaction.count({
      where: { workSourceId: id, deletedAt: null },
    });
    if (linkedCount > 0) {
      throw Object.assign(new Error("currency change blocked — linked transactions exist"), {
        code: "CURRENCY_LOCKED",
      });
    }
  }

  // Cleanup: when kind changes away from EMPLOYMENT, clear premium fields and payDay
  const incomingKind = input.kind ?? existing.kind;
  const kindChanged = input.kind != null && input.kind !== existing.kind;
  const cleanupEmploymentFields =
    kindChanged && incomingKind !== WorkKind.EMPLOYMENT;

  const data: WorkSourceUpdateInput = { ...input };

  if (cleanupEmploymentFields) {
    (data as Record<string, unknown>).premiumAmount = null;
    (data as Record<string, unknown>).premiumNote = null;
    (data as Record<string, unknown>).payDay = null;
  }

  return db.workSource.update({ where: { id }, data });
}

// Soft deactivate
export async function deactivateWorkSource(userId: string, id: string) {
  const existing = await getWorkSourceById(userId, id);
  if (!existing) throw Object.assign(new Error("work source not found"), { code: "NOT_FOUND" });

  await db.workSource.update({ where: { id }, data: { isActive: false } });
  return { id };
}
