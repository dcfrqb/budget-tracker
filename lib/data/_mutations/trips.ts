import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  TripCreateInput,
  TripUpdateInput,
  LinkFundInput,
  SetAllocationsInput,
} from "@/lib/validation/trips";

// ─────────────────────────────────────────────────────────────
// Trip mutations
// ─────────────────────────────────────────────────────────────

export async function createTrip(userId: string, input: TripCreateInput) {
  return db.trip.create({
    data: {
      ...input,
      userId,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      totalBudget: new Prisma.Decimal(input.totalBudget),
    },
    include: { currency: true, fund: true },
  });
}

export async function updateTrip(
  userId: string,
  id: string,
  input: TripUpdateInput,
) {
  const existing = await db.trip.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw Object.assign(new Error("trip not found"), { code: "NOT_FOUND" });

  const data: Record<string, unknown> = { ...input };
  if (input.startDate) data.startDate = new Date(input.startDate);
  if (input.endDate) data.endDate = new Date(input.endDate);
  if (input.totalBudget) data.totalBudget = new Prisma.Decimal(input.totalBudget);

  return db.trip.update({
    where: { id },
    data,
    include: { currency: true, fund: true },
  });
}

export async function deleteTrip(userId: string, id: string) {
  const existing = await db.trip.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw Object.assign(new Error("trip not found"), { code: "NOT_FOUND" });

  await db.trip.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
}

export async function linkFundToTrip(
  userId: string,
  tripId: string,
  input: LinkFundInput,
) {
  const existing = await db.trip.findFirst({ where: { id: tripId, userId, deletedAt: null } });
  if (!existing) throw Object.assign(new Error("trip not found"), { code: "NOT_FOUND" });

  return db.trip.update({
    where: { id: tripId },
    data: { fundId: input.fundId },
  });
}

export async function setBudgetAllocations(
  userId: string,
  tripId: string,
  input: SetAllocationsInput,
) {
  const existing = await db.trip.findFirst({ where: { id: tripId, userId, deletedAt: null } });
  if (!existing) throw Object.assign(new Error("trip not found"), { code: "NOT_FOUND" });

  return db.trip.update({
    where: { id: tripId },
    data: { budgetAllocations: input.allocations as unknown as Prisma.InputJsonValue },
  });
}
