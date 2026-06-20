import { cache } from "react";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────
// Category ref-loaders — cache()-wrapped, primitive-keyed.
//
// All args are primitives (string) so React 19 cache() keys by
// value (Map), not by reference (WeakMap). Never pass objects here.
// ─────────────────────────────────────────────────────────────

// { id, name, icon } — deliberately NO archivedAt filter (matches
// the loose query at getCategoryPie, getPeriodCompare, getShrinkableCategories,
// and dashboard. Adding the filter would silently drop archived cats = behavior change.)
export const getExpenseCategoryRefs = cache(async (userId: string) => {
  return db.category.findMany({
    where: { userId, kind: "EXPENSE" },
    select: { id: true, name: true, icon: true },
  });
});

// { id, name, limitEconomy, limitNormal, limitFree } — non-archived only.
// Used by getRunwayByMode and getEconomyExitScenario (latter only reads limitEconomy;
// extra columns are harmless and allow sharing the single cached result).
export const getExpenseCategoryLimitRefs = cache(async (userId: string) => {
  return db.category.findMany({
    where: { userId, kind: "EXPENSE", archivedAt: null },
    select: {
      id: true,
      name: true,
      limitEconomy: true,
      limitNormal: true,
      limitFree: true,
    },
  });
});

// Full row, non-archived, ordered by name asc.
// Used by long-projects new/edit pages.
export const getActiveExpenseCategoriesFull = cache(async (userId: string) => {
  return db.category.findMany({
    where: { userId, archivedAt: null, kind: "EXPENSE" },
    orderBy: { name: "asc" },
  });
});
