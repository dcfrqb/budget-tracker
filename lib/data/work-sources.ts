import { cache } from "react";
import { db } from "@/lib/db";

export const getActiveWorkSources = cache(async (userId: string) => {
  return db.workSource.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
});

export const getWorkSourceById = cache(async (userId: string, id: string) => {
  return db.workSource.findFirst({
    where: { id, userId },
  });
});

// Первый активный WorkSource по createdAt.
export const getPrimaryWorkSource = cache(async (userId: string) => {
  return db.workSource.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
});
