import { db } from "@/lib/db";
import { getBusinessById } from "@/lib/data/businesses";
import { resolveUserBaseCurrency } from "@/lib/data/_mutations/work-sources";
import type {
  BusinessCreateInput,
  BusinessUpdateInput,
} from "@/lib/validation/business";

export async function createBusiness(userId: string, input: BusinessCreateInput) {
  const currencyCode = input.currencyCode ?? (await resolveUserBaseCurrency(userId));
  return db.business.create({
    data: { ...input, currencyCode, userId },
  });
}

export async function updateBusiness(
  userId: string,
  id: string,
  input: BusinessUpdateInput,
) {
  const existing = await getBusinessById(userId, id);
  if (!existing) throw Object.assign(new Error("business not found"), { code: "NOT_FOUND" });

  if (input.currencyCode != null && input.currencyCode !== existing.currencyCode) {
    const linkedCount = await db.transaction.count({
      where: { businessId: id, deletedAt: null },
    });
    if (linkedCount > 0) {
      throw Object.assign(new Error("currency change blocked — linked transactions exist"), {
        code: "CURRENCY_LOCKED",
      });
    }
  }

  const { currencyCode: ccy, ...restData } = input;
  const prismaData = ccy != null ? { ...restData, currencyCode: ccy } : restData;

  return db.business.update({ where: { id }, data: prismaData });
}

export async function deactivateBusiness(userId: string, id: string) {
  const existing = await getBusinessById(userId, id);
  if (!existing) throw Object.assign(new Error("business not found"), { code: "NOT_FOUND" });

  await db.business.update({ where: { id }, data: { isActive: false } });
  return { id };
}

export async function activateBusiness(userId: string, id: string) {
  const existing = await getBusinessById(userId, id);
  if (!existing) throw Object.assign(new Error("business not found"), { code: "NOT_FOUND" });

  await db.business.update({ where: { id }, data: { isActive: true } });
  return { id };
}
