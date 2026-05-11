"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/api/auth";
import { withUserAction } from "@/lib/actions/with-user";
import { actionOk, actionError } from "@/lib/actions/result";
import {
  tripCreateSchema,
  tripUpdateSchema,
  tripDeleteSchema,
  linkFundSchema,
  setAllocationsSchema,
  bookingCreateSchema,
  bookingUpdateSchema,
  bookingMarkPaidSchema,
} from "@/lib/validation/trips";
import {
  createTrip,
  updateTrip,
  deleteTrip,
  linkFundToTrip,
  setBudgetAllocations,
} from "@/lib/data/_mutations/trips";
import {
  createBooking,
  updateBooking,
  deleteBooking,
  markBookingPaid,
} from "@/lib/data/_mutations/trip-bookings";

function revalidateTrips(id?: string) {
  revalidatePath("/planning");
  revalidatePath("/planning/trips");
  if (id) revalidatePath(`/planning/trips/${id}`);
  revalidatePath("/planning/calendar");
}

// ─── Trip CRUD ───────────────────────────────────────────────

export const createTripAction = withUserAction(
  tripCreateSchema,
  async (userId, input) => {
    const trip = await createTrip(userId, input);
    revalidateTrips(trip.id);
    return trip;
  },
);

export async function updateTripAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = tripUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { ok: false as const, fieldErrors };
  }
  try {
    const trip = await updateTrip(userId, id, parsed.data);
    revalidateTrips(id);
    return actionOk(trip);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function deleteTripAction(rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = tripDeleteSchema.safeParse(rawData);
  if (!parsed.success) return actionError("validation_error");
  try {
    await deleteTrip(userId, parsed.data.id);
    revalidateTrips();
    return actionOk({ id: parsed.data.id });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function linkFundAction(tripId: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = linkFundSchema.safeParse(rawData);
  if (!parsed.success) return actionError("validation_error");
  try {
    await linkFundToTrip(userId, tripId, parsed.data);
    revalidateTrips(tripId);
    return actionOk({ tripId });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function setAllocationsAction(tripId: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = setAllocationsSchema.safeParse(rawData);
  if (!parsed.success) return actionError("validation_error");
  try {
    await setBudgetAllocations(userId, tripId, parsed.data);
    revalidatePath(`/planning/trips/${tripId}`);
    return actionOk({ tripId });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─── Booking CRUD ────────────────────────────────────────────

export const createBookingAction = withUserAction(
  bookingCreateSchema,
  async (userId, input) => {
    const booking = await createBooking(userId, input);
    revalidateTrips(input.tripId);
    return booking;
  },
);

export async function updateBookingAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = bookingUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { ok: false as const, fieldErrors };
  }
  try {
    const booking = await updateBooking(userId, id, parsed.data);
    revalidatePath("/planning/trips");
    revalidatePath(`/planning/trips/${booking.tripId}`);
    return actionOk(booking);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function deleteBookingAction(id: string, tripId: string) {
  const userId = await getCurrentUserId();
  try {
    await deleteBooking(userId, id);
    revalidateTrips(tripId);
    return actionOk({ id });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

export const markBookingPaidAction = withUserAction(
  bookingMarkPaidSchema,
  async (userId, input) => {
    const result = await markBookingPaid(userId, input);
    revalidatePath("/planning/trips");
    revalidatePath(`/planning/trips/${result.booking.tripId}`);
    revalidatePath("/transactions");
    return result;
  },
);
