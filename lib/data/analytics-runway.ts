import { cache } from "react";
import { Prisma, BudgetMode } from "@prisma/client";
import { dayKeyInTz } from "@/lib/format/date";
import { DEFAULT_TZ, MODE_LIMIT_MULTIPLIER, RUNWAY_AVG_MONTHS } from "@/lib/constants";
import { getAvailableNow } from "@/lib/data/_shared/period-aggregates";
import { getCompareSparklines } from "@/lib/data/analytics";
import { getExpenseCategoryLimitRefs } from "@/lib/data/_shared/category-refs";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type RunwayByMode = {
  mode: BudgetMode;
  /** Sum of effective category limits (% of 6-mo avg) in base currency, as Decimal-string */
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

/**
 * Computes the effective monthly limit for a category in a given mode.
 * pct = override percent stored in limitEconomy/limitNormal/limitFree column (NULL = use global multiplier).
 * Result = (pct ?? globalMultiplier) / 100 * avg6mBase.
 */
export function effectiveLimitBase(
  pct: Prisma.Decimal | null,
  mode: BudgetMode,
  avg6mBase: Prisma.Decimal,
): Prisma.Decimal {
  const multiplier = pct ?? new Prisma.Decimal(MODE_LIMIT_MULTIPLIER[mode]);
  return multiplier.div(100).times(avg6mBase);
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
  avg6mMap: Map<string, Prisma.Decimal>,
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

  // Compute effective limit per category; include only those with eff > 0
  const withLimit: Array<{ id: string; name: string; eff: Prisma.Decimal }> = [];

  for (const c of categories) {
    const avg6m = avg6mMap.get(c.id) ?? new Prisma.Decimal(0);
    if (avg6m.isZero()) continue;
    const eff = effectiveLimitBase(c[limitField], mode, avg6m);
    if (eff.gt(0)) {
      withLimit.push({ id: c.id, name: c.name, eff });
    }
  }

  // Sum
  const monthlyLimitBase = withLimit.reduce(
    (acc, c) => acc.plus(c.eff),
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
  let days: number;
  if (availableNowBase.isZero() || availableNowBase.isNegative()) {
    days = 0;
  } else {
    days = availableNowBase.div(avgDailyBurnBase).floor().toNumber();
  }

  const untilDate = toISODate(addDays(asOf, days), tz);

  // Top 3 by effective limit desc
  const topCategoriesInMode = [...withLimit]
    .sort((a, b) => b.eff.comparedTo(a.eff))
    .slice(0, 3)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      limitBase: c.eff.toString(),
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

  const [categories, sparklines, availableNowResult] = await Promise.all([
    getExpenseCategoryLimitRefs(userId),
    getCompareSparklines(userId, baseCcy, tz, RUNWAY_AVG_MONTHS, asOf.getTime()),
    getAvailableNow(userId, baseCcy, asOf),
  ]);

  const availableNowBase = availableNowResult.freeBase;

  // Build avg6m map: mean of the series for each category (divide by series.length, NOT 6)
  const avg6mMap = new Map<string, Prisma.Decimal>();
  for (const [categoryId, series] of sparklines.entries()) {
    if (series.length === 0) continue;
    const sum = series.reduce((acc, v) => acc + v, 0);
    const avg = sum / series.length;
    avg6mMap.set(categoryId, new Prisma.Decimal(avg.toFixed(8)));
  }

  const byMode: Record<BudgetMode, RunwayByMode> = {
    [BudgetMode.ECONOMY]: buildRunwayForMode(
      BudgetMode.ECONOMY,
      categories,
      avg6mMap,
      availableNowBase,
      asOf,
      tz,
    ),
    [BudgetMode.NORMAL]: buildRunwayForMode(
      BudgetMode.NORMAL,
      categories,
      avg6mMap,
      availableNowBase,
      asOf,
      tz,
    ),
    [BudgetMode.FREE]: buildRunwayForMode(
      BudgetMode.FREE,
      categories,
      avg6mMap,
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
