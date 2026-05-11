import { z } from "zod";
import { TripStatus, TripBookingKind } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Trip schemas
// ─────────────────────────────────────────────────────────────

export const tripCreateSchema = z.object({
  name: z.string().min(1),
  destination: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  currencyCode: z.string().min(1),
  totalBudget: z.string().min(1),
  status: z.nativeEnum(TripStatus).optional().default("PLANNING"),
  note: z.string().optional(),
  fundId: z.string().optional().nullable(),
}).refine(
  (d) => new Date(d.startDate) <= new Date(d.endDate),
  { message: "dates_inverted", path: ["endDate"] },
).refine(
  (d) => parseFloat(d.totalBudget) > 0,
  { message: "budget_positive", path: ["totalBudget"] },
);

export type TripCreateInput = z.infer<typeof tripCreateSchema>;

export const tripUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  destination: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currencyCode: z.string().optional(),
  totalBudget: z.string().optional(),
  status: z.nativeEnum(TripStatus).optional(),
  note: z.string().optional().nullable(),
  fundId: z.string().optional().nullable(),
});

export type TripUpdateInput = z.infer<typeof tripUpdateSchema>;

export const tripDeleteSchema = z.object({
  id: z.string().min(1),
});

export type TripDeleteInput = z.infer<typeof tripDeleteSchema>;

export const linkFundSchema = z.object({
  fundId: z.string().nullable(),
});

export type LinkFundInput = z.infer<typeof linkFundSchema>;

const ALL_BOOKING_KINDS = [
  "TRANSPORT",
  "LODGING",
  "FOOD",
  "ACTIVITY",
  "OTHER",
] as const satisfies readonly TripBookingKind[];

export const setAllocationsSchema = z.object({
  allocations: z.record(z.enum(ALL_BOOKING_KINDS), z.string()),
});

export type SetAllocationsInput = z.infer<typeof setAllocationsSchema>;

// ─────────────────────────────────────────────────────────────
// TripBooking schemas
// ─────────────────────────────────────────────────────────────

export const bookingCreateSchema = z.object({
  tripId: z.string().min(1),
  kind: z.nativeEnum(TripBookingKind),
  label: z.string().min(1),
  date: z.string().min(1),
  amount: z.string().min(1),
  currencyCode: z.string().min(1),
  note: z.string().optional().nullable(),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export const bookingUpdateSchema = z.object({
  kind: z.nativeEnum(TripBookingKind).optional(),
  label: z.string().min(1).optional(),
  date: z.string().optional(),
  amount: z.string().optional(),
  currencyCode: z.string().optional(),
  note: z.string().optional().nullable(),
});

export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;

export const bookingMarkPaidSchema = z.object({
  bookingId: z.string().min(1),
  accountId: z.string().min(1),
});

export type BookingMarkPaidInput = z.infer<typeof bookingMarkPaidSchema>;
