import { cache } from "react";
import { Prisma, BudgetMode } from "@prisma/client";
import { db } from "@/lib/db";
import { dayKeyInTz } from "@/lib/format/date";
import { DEFAULT_TZ } from "@/lib/constants";
import { getAvailableNow } from "@/lib/data/_shared/period-aggregates";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type RunwayByMode = {
  mode: BudgetMode;
  /** Sum of category.limit{Mode} in base currency, as Decimal-string */
  monthlyLimitBase: string;
  /** monthlyLimitBase / 30, as Decimal-string */
  avgDailyBurnBase: string;
  /** total balance - reserved, as Decimal-string */
  availableNowBase: string;
  /** floor(availableNow / avgDailyBurn); null if no limits or burn=0 */
  days: number | null;
  /** asOf + days, ISO YYYY-MM-DD; null if days=null */
  untilDate: string | null;
  /** Top 3 categories by limit in this mode */
  topCategoriesInMode: Array<{
    categoryId: string;
    name: string;
    limitBase: string;
  }>;
};

export type RunwayDashboard = {
  /** ISO date (YYYY-MM-DD) */
  asOf: string;
  baseCurrencyCode: string;
  byMode: Record<BudgetMode, RunwayByMode>;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

/** Format a Date as YYYY-MM-DD in the given timezone (default DEFAULT_TZ) */
function toISODate(d: Date, tz: string = DEFAULT_TZ): string {
  return dayKeyInTz(d, tz);
}

// ─────────────────────────────────────────────────────────────
// availableNow calculation — delegated to the canonical helper.
// Fixes CREDIT bug (old code used acc.balance.negated() instead of
// resolveCreditState). Uses freeBase (total - reserved) which matches
// the RunwayByMode.availableNowBase semantic: "total balance - reserved".
// ─────────────────────────────────────────────────────────────

async function getAvailableNowBase(
  userId: string,
  baseCcy: string,
): Promise<Prisma.Decimal> {
  const now = new Date();
  const result = await getAvailableNow(userId, baseCcy, now);
  return result.freeBase;
}

// ─────────────────────────────────────────────────────────────
// Per-mode runway calculation (pure, no I/O)
// ─────────────────────────────────────────────────────────────

type CategoryLimitRow = {
  id: string;
  name: string;
  limitEconomy: Prisma.Decimal | null;
  limitNormal: Prisma.Decimal | null;
  limitFree: Prisma.Decimal | null;
};

function buildRunwayForMode(
  mode: BudgetMode,
  categories: CategoryLimitRow[],
  availableNowBase: Prisma.Decimal,
  asOf: Date,
  tz: string = DEFAULT_TZ,
): RunwayByMode {
  const limitField =
    mode === BudgetMode.ECONOMY
      ? "limitEconomy"
      : mode === BudgetMode.NORMAL
        ? "limitNormal"
        : "limitFree";

  // Collect non-null limits
  const withLimit = categories
    .map((c) => ({ id: c.id, name: c.name, limit: c[limitField] }))
    .filter((c): c is { id: string; name: string; limit: Prisma.Decimal } =>
      c.limit !== null,
    );

  // Sum
  const monthlyLimitBase = withLimit.reduce(
    (acc, c) => acc.plus(c.limit),
    new Prisma.Decimal(0),
  );

  if (withLimit.length === 0 || monthlyLimitBase.isZero()) {
    return {
      mode,
      monthlyLimitBase: "0",
      avgDailyBurnBase: "0",
      availableNowBase: availableNowBase.toString(),
      days: null,
      untilDate: null,
      topCategoriesInMode: [],
    };
  }

  const avgDailyBurnBase = monthlyLimitBase.div(30);

  // days = floor(availableNow / avgDailyBurn)
  // If available is 0 → 0 days (not null, since limits exist)
  let days: number;
  if (availableNowBase.isZero() || availableNowBase.isNegative()) {
    days = 0;
  } else {
    days = availableNowBase.div(avgDailyBurnBase).floor().toNumber();
  }

  const untilDate = toISODate(addDays(asOf, days), tz);

  // Top 3 by limit desc
  const topCategoriesInMode = [...withLimit]
    .sort((a, b) => b.limit.comparedTo(a.limit))
    .slice(0, 3)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      limitBase: c.limit.toString(),
    }));

  return {
    mode,
    monthlyLimitBase: monthlyLimitBase.toString(),
    avgDailyBurnBase: avgDailyBurnBase.toString(),
    availableNowBase: availableNowBase.toString(),
    days,
    untilDate,
    topCategoriesInMode,
  };
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────

export const getRunwayByMode = cache(async (
  userId: string,
  baseCcy: string,
  tz: string = DEFAULT_TZ,
): Promise<RunwayDashboard> => {
  const asOf = new Date();

  const [categories, availableNowBase] = await Promise.all([
    db.category.findMany({
      where: { userId, kind: "EXPENSE", archivedAt: null },
      select: {
        id: true,
        name: true,
        limitEconomy: true,
        limitNormal: true,
        limitFree: true,
      },
    }),
    getAvailableNowBase(userId, baseCcy),
  ]);

  const byMode: Record<BudgetMode, RunwayByMode> = {
    [BudgetMode.ECONOMY]: buildRunwayForMode(
      BudgetMode.ECONOMY,
      categories,
      availableNowBase,
      asOf,
      tz,
    ),
    [BudgetMode.NORMAL]: buildRunwayForMode(
      BudgetMode.NORMAL,
      categories,
      availableNowBase,
      asOf,
      tz,
    ),
    [BudgetMode.FREE]: buildRunwayForMode(
      BudgetMode.FREE,
      categories,
      availableNowBase,
      asOf,
      tz,
    ),
  };

  return {
    asOf: toISODate(asOf, tz),
    baseCurrencyCode: baseCcy,
    byMode,
  };
});
