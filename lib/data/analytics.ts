import { cache } from "react";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { startOfWeekInTzKey, monthKeyInTz } from "@/lib/format/date";
import { DEFAULT_TZ } from "@/lib/constants";
import { getCompensationProjection } from "@/lib/data/_shared/compensation-projection";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type DateRange = { from: Date; to: Date };

export type PeriodKpis = {
  inflowBase: string;
  outflowBase: string;
  netBase: string;
  savingsRatePct: number | null; // null если inflow = 0
};

export type CategoryPieSlice = {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  amountBase: string;
  pct: number;
};

export type PeriodCompareRow = {
  categoryId: string;
  categoryName: string;
  currentBase: string;
  previousBase: string;
  /** "new" = appeared this period (prev ≤ epsilon), "gone" = disappeared (curr ≤ epsilon), "delta" = normal comparison */
  kind: "new" | "gone" | "delta";
  deltaPct: number | null; // null when kind !== "delta"
};

export type TrendPoint = {
  bucketStart: string; // ISO date, начало периода (недели или месяца)
  inflowBase: string;
  outflowBase: string;
  netBase: string;
};

export type WeatherKind = "sun" | "cloud" | "rain" | "storm";

export type WeatherResult = {
  kind: WeatherKind;
  savingsRatePct: number | null;
  reason: string; // служебный код, не user-facing
};

export type ForecastMonth = {
  inflowExpectedBase: string;
  outflowExpectedBase: string;
  netExpectedBase: string;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}


function confirmedAmt(t: {
  status: TransactionStatus;
  amount: Prisma.Decimal;
  facts: { amount: Prisma.Decimal }[];
}): Prisma.Decimal {
  if (t.status === TransactionStatus.DONE) return new Prisma.Decimal(t.amount);
  if (t.status === TransactionStatus.PARTIAL)
    return t.facts.reduce((acc, f) => acc.plus(f.amount), new Prisma.Decimal(0));
  return new Prisma.Decimal(0);
}

// ─────────────────────────────────────────────────────────────
// resolveRange — превращает period → { from, to }
// ─────────────────────────────────────────────────────────────

export function resolveRange(
  period: "1m" | "3m" | "6m" | "12m" | "ytd" | "custom",
  from?: Date,
  to?: Date,
): DateRange {
  const now = new Date();

  if (period === "custom") {
    if (!from || !to) throw new Error("period=custom requires from and to");
    return { from, to };
  }

  if (period === "ytd") {
    const ytdFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return { from: ytdFrom, to: now };
  }

  const days: Record<string, number> = {
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "12m": 365,
  };

  const d = days[period];
  const rangeFrom = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  return { from: rangeFrom, to: now };
}

// ─────────────────────────────────────────────────────────────
// getPeriodKpis
// ─────────────────────────────────────────────────────────────

export const getPeriodKpis = cache(async (
  userId: string,
  range: DateRange,
  baseCcy: string,
): Promise<PeriodKpis> => {
  const [proj, rates] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
  ]);

  const rows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: range.from, lte: range.to },
      kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
      transferId: null,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      ...proj.whereExcludeNonMain,
    },
    select: {
      id: true,
      kind: true,
      status: true,
      amount: true,
      currencyCode: true,
      facts: { select: { amount: true } },
    },
  });

  const zero = new Prisma.Decimal(0);
  let inflow = zero;
  let outflow = zero;

  for (const t of rows) {
    const override = proj.rewriteAmount(t.id);
    if (override) {
      if (override.sign === 1) inflow = inflow.plus(override.netBase);
      else outflow = outflow.plus(override.netBase);
    } else {
      const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
      const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
      if (!inBase) continue;
      if (t.kind === TransactionKind.INCOME) inflow = inflow.plus(inBase);
      else outflow = outflow.plus(inBase);
    }
  }

  const net = inflow.minus(outflow);
  const savingsRatePct = inflow.isZero()
    ? null
    : net.div(inflow).times(100).toNumber();

  return {
    inflowBase: inflow.toString(),
    outflowBase: outflow.toString(),
    netBase: net.toString(),
    savingsRatePct,
  };
});

// ─────────────────────────────────────────────────────────────
// getCategoryPie
// ─────────────────────────────────────────────────────────────

export const getCategoryPie = cache(async (
  userId: string,
  range: DateRange,
  baseCcy: string,
): Promise<CategoryPieSlice[]> => {
  const [proj, rates, categories] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
    db.category.findMany({
      where: { userId, kind: "EXPENSE" },
      select: { id: true, name: true, icon: true },
    }),
  ]);

  const rows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: range.from, lte: range.to },
      kind: TransactionKind.EXPENSE,
      transferId: null,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      categoryId: { not: null },
      ...proj.whereExcludeNonMain,
    },
    select: {
      id: true,
      categoryId: true,
      status: true,
      amount: true,
      currencyCode: true,
      facts: { select: { amount: true } },
    },
  });

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const byCat = new Map<string, Prisma.Decimal>();

  for (const t of rows) {
    if (!t.categoryId) continue;
    const override = proj.rewriteAmount(t.id);
    let inBase: Prisma.Decimal | undefined;
    let catId = t.categoryId;
    if (override) {
      inBase = override.netBase;
      const groupInfo = proj.groupByMainTxnId.get(t.id);
      if (groupInfo?.categoryIdForAggregation) catId = groupInfo.categoryIdForAggregation;
    } else {
      const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
      const converted = convertToBase(actual, t.currencyCode, baseCcy, rates);
      if (!converted) continue;
      inBase = converted;
    }
    byCat.set(catId, (byCat.get(catId) ?? new Prisma.Decimal(0)).plus(inBase));
  }

  let total = new Prisma.Decimal(0);
  for (const v of byCat.values()) total = total.plus(v);

  const sorted = [...byCat.entries()].sort((a, b) => b[1].comparedTo(a[1]));

  return sorted.map(([catId, amount]) => {
    const cat = catMap.get(catId);
    const pct = total.isZero() ? 0 : amount.div(total).times(100).toNumber();
    return {
      categoryId: catId,
      categoryName: cat?.name ?? "—",
      icon: cat?.icon ?? null,
      amountBase: amount.toString(),
      pct: Math.round(pct * 10) / 10,
    };
  });
});

// ─────────────────────────────────────────────────────────────
// getPeriodCompare
// ─────────────────────────────────────────────────────────────

export const getPeriodCompare = cache(async (
  userId: string,
  range: DateRange,
  baseCcy: string,
  previousRange?: DateRange | null,
): Promise<PeriodCompareRow[]> => {
  // Use explicitly provided previousRange, or fall back to the period of same length immediately before
  const rangeLen = range.to.getTime() - range.from.getTime();
  const prevRange: DateRange = previousRange ?? {
    from: new Date(range.from.getTime() - rangeLen),
    to: new Date(range.to.getTime() - rangeLen),
  };

  const [proj, rates, categories] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
    db.category.findMany({
      where: { userId, kind: "EXPENSE" },
      select: { id: true, name: true, icon: true },
    }),
  ]);

  const [currentRows, prevRows] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: range.from, lte: range.to },
        kind: TransactionKind.EXPENSE,
        transferId: null,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        categoryId: { not: null },
        ...proj.whereExcludeNonMain,
      },
      select: {
        id: true,
        categoryId: true,
        status: true,
        amount: true,
        currencyCode: true,
        facts: { select: { amount: true } },
      },
    }),
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: prevRange.from, lte: prevRange.to },
        kind: TransactionKind.EXPENSE,
        transferId: null,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        categoryId: { not: null },
        ...proj.whereExcludeNonMain,
      },
      select: {
        id: true,
        categoryId: true,
        status: true,
        amount: true,
        currencyCode: true,
        facts: { select: { amount: true } },
      },
    }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const sumByCat = (txns: typeof currentRows): Map<string, Prisma.Decimal> => {
    const map = new Map<string, Prisma.Decimal>();
    for (const t of txns) {
      if (!t.categoryId) continue;
      const override = proj.rewriteAmount(t.id);
      let inBase: Prisma.Decimal | undefined;
      let catId = t.categoryId;
      if (override) {
        inBase = override.netBase;
        const groupInfo = proj.groupByMainTxnId.get(t.id);
        if (groupInfo?.categoryIdForAggregation) catId = groupInfo.categoryIdForAggregation;
      } else {
        const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
        const converted = convertToBase(actual, t.currencyCode, baseCcy, rates);
        if (!converted) continue;
        inBase = converted;
      }
      map.set(catId, (map.get(catId) ?? new Prisma.Decimal(0)).plus(inBase));
    }
    return map;
  };

  const currentByCat = sumByCat(currentRows);
  const prevByCat = sumByCat(prevRows);

  const EPSILON = new Prisma.Decimal("0.01");

  // Все категории, у которых есть движения в current или previous
  const allCatIds = new Set([...currentByCat.keys(), ...prevByCat.keys()]);

  return [...allCatIds].map((catId) => {
    const cat = catMap.get(catId);
    const current = currentByCat.get(catId) ?? new Prisma.Decimal(0);
    const prev = prevByCat.get(catId) ?? new Prisma.Decimal(0);

    let kind: PeriodCompareRow["kind"];
    let deltaPct: number | null;

    if (prev.lte(EPSILON)) {
      kind = "new";
      deltaPct = null;
    } else if (current.lte(EPSILON)) {
      kind = "gone";
      deltaPct = null;
    } else {
      kind = "delta";
      deltaPct = current.minus(prev).div(prev).times(100).toNumber();
    }

    return {
      categoryId: catId,
      categoryName: cat?.name ?? "—",
      currentBase: current.toString(),
      previousBase: prev.toString(),
      kind,
      deltaPct,
    };
  });
});

// ─────────────────────────────────────────────────────────────
// getTrendPoints
// Granularity: period='1m' → weekly, period>='3m' → monthly
// ─────────────────────────────────────────────────────────────

export const getTrendPoints = cache(async (
  userId: string,
  range: DateRange,
  baseCcy: string,
  granularity: "weekly" | "monthly" = "monthly",
  tz: string = DEFAULT_TZ,
): Promise<TrendPoint[]> => {
  const [proj, rates] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
  ]);

  const rows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: range.from, lte: range.to },
      kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
      transferId: null,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      ...proj.whereExcludeNonMain,
    },
    select: {
      id: true,
      kind: true,
      status: true,
      amount: true,
      currencyCode: true,
      occurredAt: true,
      facts: { select: { amount: true } },
    },
    orderBy: { occurredAt: "asc" },
  });

  type Bucket = { inflow: Prisma.Decimal; outflow: Prisma.Decimal };
  const buckets = new Map<string, Bucket>();

  const getBucketKey = (d: Date): string => {
    if (granularity === "weekly") {
      return startOfWeekInTzKey(d, tz);
    } else {
      return monthKeyInTz(d, tz);
    }
  };

  for (const t of rows) {
    const key = getBucketKey(t.occurredAt);
    if (!buckets.has(key)) {
      buckets.set(key, { inflow: new Prisma.Decimal(0), outflow: new Prisma.Decimal(0) });
    }
    const bucket = buckets.get(key)!;

    const override = proj.rewriteAmount(t.id);
    if (override) {
      if (override.sign === 1) bucket.inflow = bucket.inflow.plus(override.netBase);
      else bucket.outflow = bucket.outflow.plus(override.netBase);
    } else {
      const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
      const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
      if (!inBase) continue;
      if (t.kind === TransactionKind.INCOME) {
        bucket.inflow = bucket.inflow.plus(inBase);
      } else {
        bucket.outflow = bucket.outflow.plus(inBase);
      }
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => ({
      bucketStart: new Date(key).toISOString(),
      inflowBase: b.inflow.toString(),
      outflowBase: b.outflow.toString(),
      netBase: b.inflow.minus(b.outflow).toString(),
    }));
});

// ─────────────────────────────────────────────────────────────
// getWeather
// ─────────────────────────────────────────────────────────────

export const getWeather = cache(async (
  userId: string,
  baseCcy: string,
  tz: string = DEFAULT_TZ,
  range: DateRange,
): Promise<WeatherResult> => {
  const [proj, rates] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
  ]);

  const rows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: range.from, lte: range.to },
      kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
      transferId: null,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      ...proj.whereExcludeNonMain,
    },
    select: {
      id: true,
      kind: true,
      status: true,
      amount: true,
      currencyCode: true,
      occurredAt: true,
      facts: { select: { amount: true } },
    },
  });

  // Single pass: bucket by month for storm check, accumulate totals for savingsRate
  type MonthlyBucket = { inflow: Prisma.Decimal; outflow: Prisma.Decimal };
  const monthlyBuckets = new Map<string, MonthlyBucket>();
  let totalInflow = new Prisma.Decimal(0);
  let totalOutflow = new Prisma.Decimal(0);

  for (const t of rows) {
    const key = monthKeyInTz(t.occurredAt, tz);
    if (!monthlyBuckets.has(key)) {
      monthlyBuckets.set(key, { inflow: new Prisma.Decimal(0), outflow: new Prisma.Decimal(0) });
    }
    const bucket = monthlyBuckets.get(key)!;
    const override = proj.rewriteAmount(t.id);
    if (override) {
      if (override.sign === 1) {
        bucket.inflow = bucket.inflow.plus(override.netBase);
        totalInflow = totalInflow.plus(override.netBase);
      } else {
        bucket.outflow = bucket.outflow.plus(override.netBase);
        totalOutflow = totalOutflow.plus(override.netBase);
      }
    } else {
      const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
      const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
      if (!inBase) continue;
      if (t.kind === TransactionKind.INCOME) {
        bucket.inflow = bucket.inflow.plus(inBase);
        totalInflow = totalInflow.plus(inBase);
      } else {
        bucket.outflow = bucket.outflow.plus(inBase);
        totalOutflow = totalOutflow.plus(inBase);
      }
    }
  }

  const totalNet = totalInflow.minus(totalOutflow);
  const savingsRatePct = totalInflow.isZero()
    ? null
    : totalNet.div(totalInflow).times(100).toNumber();

  // Storm check: generalized for range length
  const sortedMonths = [...monthlyBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b));

  let isStorm: boolean;
  if (sortedMonths.length >= 3) {
    // Original semantics: trailing 3 months all have outflow > inflow
    const trailing3 = sortedMonths.slice(-3);
    isStorm = trailing3.every(([, b]) => b.outflow.gt(b.inflow));
  } else if (sortedMonths.length === 2) {
    isStorm = sortedMonths.every(([, b]) => b.outflow.gt(b.inflow));
  } else {
    // Single-month range: storm only when clearly negative
    isStorm =
      totalOutflow.gt(totalInflow) &&
      savingsRatePct !== null &&
      savingsRatePct < -10;
  }

  // Determine weather
  let kind: WeatherKind;
  let reason: string;

  if (isStorm) {
    kind = "storm";
    reason = "outflow_gt_inflow_period";
  } else if (savingsRatePct === null || savingsRatePct < 5) {
    kind = "rain";
    reason = "savings_rate_lt_5pct";
  } else if (savingsRatePct <= 20) {
    kind = "cloud";
    reason = "savings_rate_5_to_20pct";
  } else {
    kind = "sun";
    reason = "savings_rate_gt_20pct";
  }

  return { kind, savingsRatePct, reason };
});

// ─────────────────────────────────────────────────────────────
// getForecastMonth
// По текущему месяцу: sum всех Transaction (любой статус)
// ─────────────────────────────────────────────────────────────

export const getForecastMonth = cache(async (
  userId: string,
  baseCcy: string,
): Promise<ForecastMonth> => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const [proj, rates] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
  ]);

  const rows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: monthStart, lte: monthEnd },
      kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
      transferId: null,
      status: { notIn: [TransactionStatus.CANCELLED] },
      ...proj.whereExcludeNonMain,
    },
    select: {
      id: true,
      kind: true,
      amount: true,
      currencyCode: true,
    },
  });

  let inflow = new Prisma.Decimal(0);
  let outflow = new Prisma.Decimal(0);

  for (const t of rows) {
    const override = proj.rewriteAmount(t.id);
    if (override) {
      if (override.sign === 1) inflow = inflow.plus(override.netBase);
      else outflow = outflow.plus(override.netBase);
    } else {
      const inBase = convertToBase(t.amount, t.currencyCode, baseCcy, rates);
      if (!inBase) continue;
      if (t.kind === TransactionKind.INCOME) inflow = inflow.plus(inBase);
      else outflow = outflow.plus(inBase);
    }
  }

  const net = inflow.minus(outflow);
  return {
    inflowExpectedBase: inflow.toString(),
    outflowExpectedBase: outflow.toString(),
    netExpectedBase: net.toString(),
  };
});
