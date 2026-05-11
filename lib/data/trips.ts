import { cache } from "react";
import { db } from "@/lib/db";

export const getTrips = cache(async (userId: string) => {
  return db.trip.findMany({
    where: { userId, deletedAt: null, status: { not: "ARCHIVED" } },
    include: { currency: true, fund: true },
    orderBy: { startDate: "asc" },
  });
});

export const getTripById = cache(async (userId: string, id: string) => {
  return db.trip.findFirst({
    where: { id, userId, deletedAt: null },
    include: { currency: true, fund: true },
  });
});

export const getTripWithBookings = cache(async (userId: string, id: string) => {
  return db.trip.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      currency: true,
      fund: true,
      bookings: {
        include: { currency: true },
        orderBy: { date: "asc" },
      },
    },
  });
});

export const getActiveTripsInRange = cache(
  async (userId: string, from: Date, to: Date) => {
    return db.trip.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { not: "ARCHIVED" },
        startDate: { lte: to },
        endDate: { gte: from },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        totalBudget: true,
        currencyCode: true,
      },
    });
  },
);
