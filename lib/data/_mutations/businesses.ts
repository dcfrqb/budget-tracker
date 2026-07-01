import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getBusinessById } from "@/lib/data/businesses";
import { resolveUserBaseCurrency } from "@/lib/data/_mutations/work-sources";
import type {
  BusinessCreateInput,
  BusinessUpdateInput,
  BusinessAllocationCreateInput,
  BusinessAllocationUpdateInput,
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

// ─────────────────────────────────────────────────────────────
// BusinessAllocation
// ─────────────────────────────────────────────────────────────

export async function createBusinessAllocation(
  userId: string,
  input: BusinessAllocationCreateInput,
) {
  const business = await getBusinessById(userId, input.businessId);
  if (!business) throw Object.assign(new Error("business not found"), { code: "NOT_FOUND" });

  if (input.transactionId != null) {
    const txn = await db.transaction.findFirst({
      where: { id: input.transactionId, userId, deletedAt: null },
      select: { id: true, businessId: true, amount: true, currencyCode: true, occurredAt: true },
    });
    if (!txn) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });
    if (txn.businessId != null && txn.businessId !== input.businessId) {
      throw Object.assign(new Error("transaction linked to a different business"), {
        code: "NOT_FOUND",
      });
    }

    const existingSum = await db.businessAllocation.aggregate({
      where: { transactionId: txn.id },
      _sum: { amount: true },
    });
    const already = existingSum._sum.amount ?? new Prisma.Decimal(0);
    const next = already.plus(new Prisma.Decimal(input.amount));
    if (next.gt(txn.amount)) {
      throw Object.assign(new Error("allocations exceed transaction amount"), {
        code: "OVER_ALLOCATED",
      });
    }

    if (txn.businessId == null) {
      await db.transaction.update({
        where: { id: txn.id },
        data: { businessId: input.businessId },
      });
    }

    return db.businessAllocation.create({
      data: {
        userId,
        businessId: input.businessId,
        transactionId: txn.id,
        amount: new Prisma.Decimal(input.amount),
        currencyCode: input.currencyCode ?? txn.currencyCode,
        entryType: input.entryType,
        streamKey: input.streamKey ?? undefined,
        tariff: input.tariff ?? undefined,
        note: input.note ?? undefined,
        occurredAt: input.occurredAt ?? txn.occurredAt,
      },
    });
  }

  // Off-app allocation — occurredAt & currencyCode are guaranteed by the schema refine.
  return db.businessAllocation.create({
    data: {
      userId,
      businessId: input.businessId,
      transactionId: null,
      amount: new Prisma.Decimal(input.amount),
      currencyCode: input.currencyCode!,
      entryType: input.entryType,
      streamKey: input.streamKey ?? undefined,
      tariff: input.tariff ?? undefined,
      note: input.note ?? undefined,
      occurredAt: input.occurredAt!,
    },
  });
}

export async function updateBusinessAllocation(
  userId: string,
  id: string,
  input: BusinessAllocationUpdateInput,
) {
  const existing = await db.businessAllocation.findFirst({ where: { id, userId } });
  if (!existing) throw Object.assign(new Error("allocation not found"), { code: "NOT_FOUND" });

  if (input.amount != null && existing.transactionId != null) {
    const txn = await db.transaction.findFirst({
      where: { id: existing.transactionId },
      select: { amount: true },
    });
    if (txn) {
      const otherSum = await db.businessAllocation.aggregate({
        where: { transactionId: existing.transactionId, id: { not: id } },
        _sum: { amount: true },
      });
      const others = otherSum._sum.amount ?? new Prisma.Decimal(0);
      const next = others.plus(new Prisma.Decimal(input.amount));
      if (next.gt(txn.amount)) {
        throw Object.assign(new Error("allocations exceed transaction amount"), {
          code: "OVER_ALLOCATED",
        });
      }
    }
  }

  const { amount, ...rest } = input;
  return db.businessAllocation.update({
    where: { id },
    data: {
      ...rest,
      streamKey: rest.streamKey ?? undefined,
      tariff: rest.tariff ?? undefined,
      note: rest.note ?? undefined,
      ...(amount != null ? { amount: new Prisma.Decimal(amount) } : {}),
    },
  });
}

export async function deleteBusinessAllocation(userId: string, id: string) {
  const existing = await db.businessAllocation.findFirst({ where: { id, userId } });
  if (!existing) throw Object.assign(new Error("allocation not found"), { code: "NOT_FOUND" });

  await db.businessAllocation.delete({ where: { id } });
  return { id };
}
