import { db } from "@/lib/db";
import { getWorkSourceById } from "@/lib/data/work-sources";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import type {
  WorkSourceCreateInput,
  WorkSourceUpdateInput,
} from "@/lib/validation/work-source";

// ─────────────────────────────────────────────────────────────
// WorkSource mutations
// ─────────────────────────────────────────────────────────────

export async function resolveUserBaseCurrency(userId: string): Promise<string> {
  // Use the primary non-archived account's currency, fallback to DEFAULT_CURRENCY
  const primary = await db.account.findFirst({
    where: { userId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { currencyCode: true },
  });
  return primary?.currencyCode ?? DEFAULT_CURRENCY;
}

export async function createWorkSource(userId: string, input: WorkSourceCreateInput) {
  const currencyCode = input.currencyCode ?? (await resolveUserBaseCurrency(userId));
  return db.workSource.create({
    data: { ...input, currencyCode, userId },
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
  const kindChanged = input.kind !== undefined && input.kind !== existing.kind;
  const cleanupEmploymentFields =
    kindChanged && incomingKind !== "EMPLOYMENT";

  const data: WorkSourceUpdateInput = { ...input };

  if (cleanupEmploymentFields) {
    (data as Record<string, unknown>).premiumAmount = null;
    (data as Record<string, unknown>).premiumNote = null;
    (data as Record<string, unknown>).payDay = null;
  }

  // Strip null for required Prisma fields (currencyCode is non-nullable in schema)
  const { currencyCode: ccy, ...restData } = data;
  const prismaData = ccy != null ? { ...restData, currencyCode: ccy } : restData;

  return db.workSource.update({ where: { id }, data: prismaData });
}

// Soft deactivate
export async function deactivateWorkSource(userId: string, id: string) {
  const existing = await getWorkSourceById(userId, id);
  if (!existing) throw Object.assign(new Error("work source not found"), { code: "NOT_FOUND" });

  await db.workSource.update({ where: { id }, data: { isActive: false } });
  return { id };
}

// Re-activate
export async function activateWorkSource(userId: string, id: string) {
  const existing = await getWorkSourceById(userId, id);
  if (!existing) throw Object.assign(new Error("work source not found"), { code: "NOT_FOUND" });

  await db.workSource.update({ where: { id }, data: { isActive: true } });
  return { id };
}
