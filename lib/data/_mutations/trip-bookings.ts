import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  BookingCreateInput,
  BookingUpdateInput,
  BookingMarkPaidInput,
} from "@/lib/validation/trips";

// ─────────────────────────────────────────────────────────────
// TripBooking mutations
// ─────────────────────────────────────────────────────────────

export async function createBooking(userId: string, input: BookingCreateInput) {
  const trip = await db.trip.findFirst({
    where: { id: input.tripId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!trip) throw Object.assign(new Error("trip not found"), { code: "NOT_FOUND" });

  return db.tripBooking.create({
    data: {
      tripId: input.tripId,
      kind: input.kind,
      label: input.label,
      date: new Date(input.date),
      amount: new Prisma.Decimal(input.amount),
      currencyCode: input.currencyCode,
      note: input.note ?? null,
    },
    include: { currency: true },
  });
}

export async function updateBooking(
  userId: string,
  id: string,
  input: BookingUpdateInput,
) {
  const existing = await db.tripBooking.findFirst({
    where: { id },
    include: { trip: { select: { userId: true } } },
  });
  if (!existing || existing.trip.userId !== userId) {
    throw Object.assign(new Error("booking not found"), { code: "NOT_FOUND" });
  }

  const data: Record<string, unknown> = {};
  if (input.kind !== undefined) data.kind = input.kind;
  if (input.label !== undefined) data.label = input.label;
  if (input.date !== undefined) data.date = new Date(input.date);
  if (input.amount !== undefined) data.amount = new Prisma.Decimal(input.amount);
  if (input.currencyCode !== undefined) data.currencyCode = input.currencyCode;
  if (input.note !== undefined) data.note = input.note;

  return db.tripBooking.update({
    where: { id },
    data,
    include: { currency: true },
  });
}

export async function deleteBooking(userId: string, id: string) {
  const existing = await db.tripBooking.findFirst({
    where: { id },
    include: { trip: { select: { userId: true } } },
  });
  if (!existing || existing.trip.userId !== userId) {
    throw Object.assign(new Error("booking not found"), { code: "NOT_FOUND" });
  }
  if (existing.status === "PAID") {
    throw Object.assign(new Error("cannot delete a paid booking"), { code: "CONFLICT" });
  }

  await db.tripBooking.delete({ where: { id } });
  return { id };
}

export async function markBookingPaid(userId: string, input: BookingMarkPaidInput) {
  const booking = await db.tripBooking.findFirst({
    where: { id: input.bookingId },
    include: { trip: { select: { userId: true, id: true } } },
  });
  if (!booking || booking.trip.userId !== userId) {
    throw Object.assign(new Error("booking not found"), { code: "NOT_FOUND" });
  }
  if (booking.status === "PAID") {
    throw Object.assign(new Error("booking already paid"), { code: "CONFLICT" });
  }

  const account = await db.account.findFirst({
    where: { id: input.accountId, userId, deletedAt: null, isArchived: false },
    select: { id: true },
  });
  if (!account) throw Object.assign(new Error("account not found or archived"), { code: "NOT_FOUND" });

  return db.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId: input.accountId,
        kind: "EXPENSE",
        status: "DONE",
        amount: booking.amount,
        currencyCode: booking.currencyCode,
        occurredAt: booking.date,
        name: booking.label,
        note: booking.note ?? null,
        tripId: booking.trip.id,
      },
    });

    const updatedBooking = await tx.tripBooking.update({
      where: { id: input.bookingId },
      data: {
        status: "PAID",
        transactionId: transaction.id,
      },
      include: { currency: true },
    });

    return { booking: updatedBooking, transactionId: transaction.id };
  });
}
