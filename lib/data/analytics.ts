import { cache } from "react";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";

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
  deltaPct: number | null; // null если prev = 0
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

function startOfWeek(d: Date): Date {
  // Понедельник как начало недели
  const day = d.getUTCDay(); // 0=Sun, 1=Mon ...
  const diff = (day === 0 ? -6 : 1 - day);
  const result = new Date(d);
  result.setUTCDate(d.getUTCDate() + diff);
  result.setUTCHours(0, 0, 0, 0);
  return result;
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
  period: "1m" | "3m" | "6m" | "12m" | "custom",
  from?: Date,
  to?: Date,
): DateRange {
  const now = new Date();

  if (period === "custom") {
    if (!from || !to) throw new Error("period=custom requires from and to");
    return { from, to };
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
  const [rows, rates] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: range.from, lte: range.to },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      },
      select: {
        kind: true,
        status: true,
        amount: true,
        currencyCode: true,
        facts: { select: { amount: true } },
      },
    }),
    getLatestRatesMap(),
  ]);

  const zero = new Prisma.Decimal(0);
  let inflow = zero;
  let outflow = zero;

  for (const t of rows) {
    const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;
    if (t.kind === TransactionKind.INCOME) inflow = inflow.plus(inBase);
    else outflow = outflow.plus(inBase);
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
  const [rows, rates, categories] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: range.from, lte: range.to },
        kind: TransactionKind.EXPENSE,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        categoryId: { not: null },
      },
      select: {
        categoryId: true,
        status: true,
        amount: true,
        currencyCode: true,
        facts: { select: { amount: true } },
      },
    }),
    getLatestRatesMap(),
    db.category.findMany({
      where: { userId, kind: "EXPENSE" },
      select: { id: true, name: true, icon: true },
    }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const byCat = new Map<string, Prisma.Decimal>();

  for (const t of rows) {
    if (!t.categoryId) continue;
    const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;
    byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? new Prisma.Decimal(0)).plus(inBase));
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

  const [currentRows, prevRows, rates, categories] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: range.from, lte: range.to },
        kind: TransactionKind.EXPENSE,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        categoryId: { not: null },
      },
      select: {
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
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        categoryId: { not: null },
      },
      select: {
        categoryId: true,
        status: true,
        amount: true,
        currencyCode: true,
        facts: { select: { amount: true } },
      },
    }),
    getLatestRatesMap(),
    db.category.findMany({
      where: { userId, kind: "EXPENSE" },
      select: { id: true, name: true, icon: true },
    }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const sumByCat = (txns: typeof currentRows): Map<string, Prisma.Decimal> => {
    const map = new Map<string, Prisma.Decimal>();
    for (const t of txns) {
      if (!t.categoryId) continue;
      const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
      const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
      if (!inBase) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? new Prisma.Decimal(0)).plus(inBase));
    }
    return map;
  };

  const currentByCat = sumByCat(currentRows);
  const prevByCat = sumByCat(prevRows);

  // Все категории, у которых есть движения в current или previous
  const allCatIds = new Set([...currentByCat.keys(), ...prevByCat.keys()]);

  return [...allCatIds].map((catId) => {
    const cat = catMap.get(catId);
    const current = currentByCat.get(catId) ?? new Prisma.Decimal(0);
    const prev = prevByCat.get(catId) ?? new Prisma.Decimal(0);
    const deltaPct = prev.isZero()
      ? null
      : current.minus(prev).div(prev).times(100).toNumber();

    return {
      categoryId: catId,
      categoryName: cat?.name ?? "—",
      currentBase: current.toString(),
      previousBase: prev.toString(),
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
): Promise<TrendPoint[]> => {
  const [rows, rates] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: range.from, lte: range.to },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      },
      select: {
        kind: true,
        status: true,
        amount: true,
        currencyCode: true,
        occurredAt: true,
        facts: { select: { amount: true } },
      },
      orderBy: { occurredAt: "asc" },
    }),
    getLatestRatesMap(),
  ]);

  type Bucket = { inflow: Prisma.Decimal; outflow: Prisma.Decimal };
  const buckets = new Map<string, Bucket>();

  const getBucketKey = (d: Date): string => {
    if (granularity === "weekly") {
      const start = startOfWeek(d);
      return start.toISOString().slice(0, 10);
    } else {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    }
  };

  for (const t of rows) {
    const key = getBucketKey(t.occurredAt);
    if (!buckets.has(key)) {
      buckets.set(key, { inflow: new Prisma.Decimal(0), outflow: new Prisma.Decimal(0) });
    }
    const bucket = buckets.get(key)!;

    const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;

    if (t.kind === TransactionKind.INCOME) {
      bucket.inflow = bucket.inflow.plus(inBase);
    } else {
      bucket.outflow = bucket.outflow.plus(inBase);
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
): Promise<WeatherResult> => {
  const now = new Date();

  // Последний месяц для savingsRate
  const lastMonthStart = startOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const lastMonthEnd = endOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));

  // Последние 3 месяца для storm-check
  const threeMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));

  const [lastMonthRows, last3MonthsRows, rates] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: lastMonthStart, lte: lastMonthEnd },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      },
      select: {
        kind: true,
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
        occurredAt: { gte: threeMonthsAgo, lte: lastMonthEnd },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      },
      select: {
        kind: true,
        status: true,
        amount: true,
        currencyCode: true,
        occurredAt: true,
        facts: { select: { amount: true } },
      },
    }),
    getLatestRatesMap(),
  ]);

  // savingsRate по последнему месяцу
  let lastMonthInflow = new Prisma.Decimal(0);
  let lastMonthOutflow = new Prisma.Decimal(0);
  for (const t of lastMonthRows) {
    const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;
    if (t.kind === TransactionKind.INCOME) lastMonthInflow = lastMonthInflow.plus(inBase);
    else lastMonthOutflow = lastMonthOutflow.plus(inBase);
  }

  const lastMonthNet = lastMonthInflow.minus(lastMonthOutflow);
  const savingsRatePct = lastMonthInflow.isZero()
    ? null
    : lastMonthNet.div(lastMonthInflow).times(100).toNumber();

  // Storm check: outflow > inflow в 3-х последних месяцах подряд
  type MonthlyBucket = { inflow: Prisma.Decimal; outflow: Prisma.Decimal };
  const monthlyBuckets = new Map<string, MonthlyBucket>();

  for (const t of last3MonthsRows) {
    const key = `${t.occurredAt.getUTCFullYear()}-${String(t.occurredAt.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!monthlyBuckets.has(key)) {
      monthlyBuckets.set(key, { inflow: new Prisma.Decimal(0), outflow: new Prisma.Decimal(0) });
    }
    const bucket = monthlyBuckets.get(key)!;
    const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;
    if (t.kind === TransactionKind.INCOME) bucket.inflow = bucket.inflow.plus(inBase);
    else bucket.outflow = bucket.outflow.plus(inBase);
  }

  // Берём последние 3 месяца в правильном порядке
  const sortedMonths = [...monthlyBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-3);

  const isStorm =
    sortedMonths.length === 3 &&
    sortedMonths.every(([, b]) => b.outflow.gt(b.inflow));

  // Определяем погоду
  let kind: WeatherKind;
  let reason: string;

  if (isStorm) {
    kind = "storm";
    reason = "outflow_gt_inflow_3_months";
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

  const [rows, rates] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: monthStart, lte: monthEnd },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
        status: { notIn: [TransactionStatus.CANCELLED] },
      },
      select: {
        kind: true,
        amount: true,
        currencyCode: true,
      },
    }),
    getLatestRatesMap(),
  ]);

  let inflow = new Prisma.Decimal(0);
  let outflow = new Prisma.Decimal(0);

  for (const t of rows) {
    const inBase = convertToBase(t.amount, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;
    if (t.kind === TransactionKind.INCOME) inflow = inflow.plus(inBase);
    else outflow = outflow.plus(inBase);
  }

  const net = inflow.minus(outflow);
  return {
    inflowExpectedBase: inflow.toString(),
    outflowExpectedBase: outflow.toString(),
    netExpectedBase: net.toString(),
  };
});
