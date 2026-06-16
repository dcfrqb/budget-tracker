import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getFreelanceOrderById } from "@/lib/data/freelance-orders";
import type {
  FreelanceOrderCreateInput,
  FreelanceOrderUpdateInput,
} from "@/lib/validation/freelance-order";

function notFound(): never {
  throw Object.assign(new Error("freelance order not found"), { code: "NOT_FOUND" });
}

function toDecimalOrNull(v: string | null | undefined): Prisma.Decimal | null {
  if (v == null) return null;
  return new Prisma.Decimal(v);
}

export async function createFreelanceOrder(
  userId: string,
  input: FreelanceOrderCreateInput,
) {
  const ws = await db.workSource.findFirst({
    where: { id: input.workSourceId, userId },
    select: { kind: true },
  });
  if (!ws || ws.kind !== "FREELANCE") notFound();

  return db.freelanceOrder.create({
    data: {
      userId,
      workSourceId: input.workSourceId,
      title: input.title,
      description: input.description ?? null,
      client: input.client ?? null,
      amount: new Prisma.Decimal(input.amount),
      currencyCode: input.currencyCode,
      hours: toDecimalOrNull(input.hours ?? null),
      hourlyRate: toDecimalOrNull(input.hourlyRate ?? null),
      tipsAmount: toDecimalOrNull(input.tipsAmount ?? null),
      status: input.status,
      performedAt: input.performedAt ?? null,
      paidAt: input.paidAt ?? null,
      note: input.note ?? null,
    },
  });
}

export async function updateFreelanceOrder(
  userId: string,
  id: string,
  input: FreelanceOrderUpdateInput,
) {
  const existing = await getFreelanceOrderById(userId, id);
  if (!existing) notFound();

  return db.freelanceOrder.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.client !== undefined && { client: input.client ?? null }),
      ...(input.amount !== undefined && input.amount !== null && { amount: new Prisma.Decimal(input.amount) }),
      ...(input.currencyCode !== undefined && { currencyCode: input.currencyCode }),
      ...(input.hours !== undefined && { hours: toDecimalOrNull(input.hours ?? null) }),
      ...(input.hourlyRate !== undefined && { hourlyRate: toDecimalOrNull(input.hourlyRate ?? null) }),
      ...(input.tipsAmount !== undefined && { tipsAmount: toDecimalOrNull(input.tipsAmount ?? null) }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.performedAt !== undefined && { performedAt: input.performedAt ?? null }),
      ...(input.paidAt !== undefined && { paidAt: input.paidAt ?? null }),
      ...(input.note !== undefined && { note: input.note ?? null }),
    },
  });
}

export async function deleteFreelanceOrder(userId: string, id: string) {
  const existing = await getFreelanceOrderById(userId, id);
  if (!existing) notFound();

  await db.freelanceOrder.delete({ where: { id } });
  return { id };
}
