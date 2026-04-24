import { cache } from "react";
import type { CategoryKind } from "@prisma/client";
import { db } from "@/lib/db";

export const getCategories = cache(async (
  userId: string,
  opts: { includeArchived?: boolean; kind?: CategoryKind } = {},
) => {
  return db.category.findMany({
    where: {
      userId,
      ...(opts.includeArchived ? {} : { archivedAt: null }),
      ...(opts.kind ? { kind: opts.kind } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
});

export const getCategoryById = cache(async (
  userId: string,
  id: string,
) => {
  return db.category.findFirst({
    where: { id, userId },
  });
});
