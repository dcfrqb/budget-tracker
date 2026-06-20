import { cache } from "react";
import type { CategoryKind } from "@prisma/client";
import { db } from "@/lib/db";

// Inner cache()-wrapped function with PRIMITIVE args so React 19 keys by value.
const _getCategories = cache(async (
  userId: string,
  includeArchived: boolean,
  kind: string,
) => {
  return db.category.findMany({
    where: {
      userId,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(kind ? { kind: kind as CategoryKind } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
});

// Public API — keeps the EXACT same signature and behavior as before.
export const getCategories = async (
  userId: string,
  opts: { includeArchived?: boolean; kind?: CategoryKind } = {},
) => {
  return _getCategories(userId, opts.includeArchived ?? false, opts.kind ?? "");
};

export const getCategoryById = cache(async (
  userId: string,
  id: string,
) => {
  return db.category.findFirst({
    where: { id, userId },
  });
});
