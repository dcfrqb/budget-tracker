import { cache } from "react";
import { db } from "@/lib/db";
import { Prisma, TransactionKind, TransactionStatus, BusinessEntryType } from "@prisma/client";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { startOfMonthUtcInTz } from "@/lib/data/_period";
import { convertToBase, getLatestRatesMap } from "@/lib/data/wallet";

export const getActiveBusinesses = cache(async (userId: string) => {
  return db.business.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
});

export const getBusinessById = cache(async (userId: string, id: string) => {
  return db.business.findFirst({ where: { id, userId } });
});

export type BusinessDetail = {
  business: Awaited<ReturnType<typeof db.business.findFirst>> & object;
  txnCount: number;
  lastTxnAt: Date | null;
  hasLinkedTxns: boolean;
};

export const getBusinessWithCounts = cache(
  async (userId: string, id: string): Promise<BusinessDetail | null> => {
    const business = await db.business.findFirst({ where: { id, userId } });
    if (!business) return null;

    const [txnCount, lastTxn, allocationCount, lastAllocation] = await Promise.all([
      db.transaction.count({ where: { businessId: id, deletedAt: null } }),
      db.transaction.findFirst({
        where: { businessId: id, deletedAt: null },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
      db.businessAllocation.count({ where: { businessId: id, transactionId: null } }),
      db.businessAllocation.findFirst({
        where: { businessId: id, transactionId: null },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
    ]);

    const lastTxnAt =
      lastTxn?.occurredAt && lastAllocation?.occurredAt
        ? lastTxn.occurredAt > lastAllocation.occurredAt
          ? lastTxn.occurredAt
          : lastAllocation.occurredAt
        : (lastTxn?.occurredAt ?? lastAllocation?.occurredAt ?? null);

    return {
      business,
      txnCount,
      lastTxnAt,
      hasLinkedTxns: txnCount > 0 || allocationCount > 0,
    };
  },
);

// ─────────────────────────────────────────────────────────────
// P&L aggregator
// ─────────────────────────────────────────────────────────────

export type BusinessPnLRow = {
  monthKey: string;
  revenue: Prisma.Decimal;
  passThrough: Prisma.Decimal;
  expenses: Prisma.Decimal;
  profit: Prisma.Decimal;
  cumulativeProfit: Prisma.Decimal;
};

export type BusinessPnLTotals = {
  revenue: Prisma.Decimal;
  passThrough: Prisma.Decimal;
  expenses: Prisma.Decimal;
  profit: Prisma.Decimal;
};

export type BusinessPnL = {
  rows: BusinessPnLRow[];
  totals: BusinessPnLTotals;
};

function effectiveTxnAmount(txn: {
  amount: Prisma.Decimal;
  status: TransactionStatus;
  facts: { amount: Prisma.Decimal }[];
}): Prisma.Decimal {
  if (txn.status === TransactionStatus.DONE) {
    return new Prisma.Decimal(txn.amount);
  }
  return txn.facts.reduce((s, f) => s.plus(f.amount), new Prisma.Decimal(0));
}

function tzMonthKey(fmt: Intl.DateTimeFormat, d: Date): string {
  const parts = fmt.formatToParts(d);
  const yr = parts.find((p) => p.type === "year")!.value;
  const mo = parts.find((p) => p.type === "month")!.value;
  return `${yr}-${mo}`;
}

export const getBusinessPnL = cache(
  async (
    userId: string,
    businessId: string,
    bounds: { from: Date; to: Date },
    baseCcy: string,
  ): Promise<BusinessPnL> => {
    const [tz, rates] = await Promise.all([getCurrentUserTz(), getLatestRatesMap()]);

    const [txns, allocations] = await Promise.all([
      db.transaction.findMany({
        where: {
          userId,
          businessId,
          deletedAt: null,
          status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
          occurredAt: { gte: bounds.from, lte: bounds.to },
        },
        select: {
          id: true,
          occurredAt: true,
          kind: true,
          amount: true,
          currencyCode: true,
          status: true,
          businessEntryType: true,
          facts: { select: { amount: true } },
        },
      }),
      db.businessAllocation.findMany({
        where: {
          userId,
          businessId,
          occurredAt: { gte: bounds.from, lte: bounds.to },
        },
        select: {
          amount: true,
          currencyCode: true,
          entryType: true,
          occurredAt: true,
          transactionId: true,
        },
      }),
    ]);

    const allocatedTxnIds = new Set(
      allocations.filter((a) => a.transactionId != null).map((a) => a.transactionId as string),
    );

    const tzMonthFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    });

    type Bucket = { revenue: Prisma.Decimal; passThrough: Prisma.Decimal; expenses: Prisma.Decimal };
    const bucketMap = new Map<string, Bucket>();

    const totals: BusinessPnLTotals = {
      revenue: new Prisma.Decimal(0),
      passThrough: new Prisma.Decimal(0),
      expenses: new Prisma.Decimal(0),
      profit: new Prisma.Decimal(0),
    };

    function getBucket(key: string): Bucket {
      const bucket = bucketMap.get(key) ?? {
        revenue: new Prisma.Decimal(0),
        passThrough: new Prisma.Decimal(0),
        expenses: new Prisma.Decimal(0),
      };
      bucketMap.set(key, bucket);
      return bucket;
    }

    for (const txn of txns) {
      // Allocation-managed transactions skip the whole-txn contribution —
      // their allocations are counted below instead (the double-count guard).
      if (allocatedTxnIds.has(txn.id)) continue;

      const key = tzMonthKey(tzMonthFmt, txn.occurredAt);
      const native = effectiveTxnAmount(txn);
      const inBase = convertToBase(native, txn.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
      const bucket = getBucket(key);

      if (txn.kind === TransactionKind.INCOME) {
        if (txn.businessEntryType === BusinessEntryType.PASS_THROUGH) {
          bucket.passThrough = bucket.passThrough.plus(inBase);
          totals.passThrough = totals.passThrough.plus(inBase);
        } else {
          bucket.revenue = bucket.revenue.plus(inBase);
          totals.revenue = totals.revenue.plus(inBase);
        }
      } else if (txn.kind === TransactionKind.EXPENSE) {
        bucket.expenses = bucket.expenses.plus(inBase);
        totals.expenses = totals.expenses.plus(inBase);
      }
    }

    for (const alloc of allocations) {
      const key = tzMonthKey(tzMonthFmt, alloc.occurredAt);
      const inBase =
        convertToBase(alloc.amount, alloc.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
      const bucket = getBucket(key);

      if (alloc.entryType === BusinessEntryType.REVENUE) {
        bucket.revenue = bucket.revenue.plus(inBase);
        totals.revenue = totals.revenue.plus(inBase);
      } else if (alloc.entryType === BusinessEntryType.PASS_THROUGH) {
        bucket.passThrough = bucket.passThrough.plus(inBase);
        totals.passThrough = totals.passThrough.plus(inBase);
      } else if (alloc.entryType === BusinessEntryType.EXPENSE) {
        bucket.expenses = bucket.expenses.plus(inBase);
        totals.expenses = totals.expenses.plus(inBase);
      }
    }

    totals.profit = totals.revenue.minus(totals.expenses);

    // Zero-fill every month in bounds
    const rows: BusinessPnLRow[] = [];
    const cursor = startOfMonthUtcInTz(tz, bounds.from);
    const end = bounds.to;

    while (cursor <= end) {
      const key = tzMonthKey(tzMonthFmt, cursor);
      const bucket = bucketMap.get(key) ?? {
        revenue: new Prisma.Decimal(0),
        passThrough: new Prisma.Decimal(0),
        expenses: new Prisma.Decimal(0),
      };
      const profit = bucket.revenue.minus(bucket.expenses);
      rows.push({
        monthKey: key,
        revenue: bucket.revenue,
        passThrough: bucket.passThrough,
        expenses: bucket.expenses,
        profit,
        cumulativeProfit: new Prisma.Decimal(0), // filled in below
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    let running = new Prisma.Decimal(0);
    for (const row of rows) {
      running = running.plus(row.profit);
      row.cumulativeProfit = running;
    }

    return { rows, totals };
  },
);

// ─────────────────────────────────────────────────────────────
// Card summaries (index page) — batched, no N+1
// ─────────────────────────────────────────────────────────────

export type BusinessCardSummary = {
  id: string;
  name: string;
  note: string | null;
  currencyCode: string;
  startedAt: Date | null;
  isActive: boolean;
  txnCount: number;
  periodRevenue: Prisma.Decimal;
  periodExpenses: Prisma.Decimal;
  periodProfit: Prisma.Decimal;
};

export const getBusinessCardSummaries = cache(
  async (userId: string): Promise<BusinessCardSummary[]> => {
    const tz = await getCurrentUserTz();
    const now = new Date();
    const periodStart = startOfMonthUtcInTz(tz, now);

    const businesses = await db.business.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });

    if (businesses.length === 0) return [];

    const businessIds = businesses.map((b) => b.id);

    const [txns, allocations, allTxnCounts] = await Promise.all([
      db.transaction.findMany({
        where: {
          userId,
          businessId: { in: businessIds },
          deletedAt: null,
          status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
          occurredAt: { gte: periodStart, lte: now },
        },
        select: {
          id: true,
          businessId: true,
          kind: true,
          amount: true,
          currencyCode: true,
          status: true,
          businessEntryType: true,
          facts: { select: { amount: true } },
        },
      }),
      db.businessAllocation.findMany({
        where: {
          userId,
          businessId: { in: businessIds },
          occurredAt: { gte: periodStart, lte: now },
        },
        select: {
          businessId: true,
          amount: true,
          currencyCode: true,
          entryType: true,
          transactionId: true,
        },
      }),
      db.transaction.groupBy({
        by: ["businessId"],
        where: { userId, businessId: { in: businessIds }, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const countByBusiness = new Map(allTxnCounts.map((r) => [r.businessId as string, r._count._all]));

    const allocatedTxnIds = new Set(
      allocations.filter((a) => a.transactionId != null).map((a) => a.transactionId as string),
    );

    type Agg = { revenue: Prisma.Decimal; expenses: Prisma.Decimal };
    const aggByBusiness = new Map<string, Agg>();
    for (const id of businessIds) {
      aggByBusiness.set(id, { revenue: new Prisma.Decimal(0), expenses: new Prisma.Decimal(0) });
    }

    for (const txn of txns) {
      if (!txn.businessId) continue;
      if (allocatedTxnIds.has(txn.id)) continue; // double-count guard
      const agg = aggByBusiness.get(txn.businessId);
      if (!agg) continue;
      const amount = effectiveTxnAmount(txn);
      if (txn.kind === TransactionKind.INCOME) {
        if (txn.businessEntryType !== BusinessEntryType.PASS_THROUGH) {
          agg.revenue = agg.revenue.plus(amount);
        }
      } else if (txn.kind === TransactionKind.EXPENSE) {
        agg.expenses = agg.expenses.plus(amount);
      }
    }

    for (const alloc of allocations) {
      const agg = aggByBusiness.get(alloc.businessId);
      if (!agg) continue;
      // Matches the pre-existing whole-txn behaviour: card summaries sum native
      // amounts without currency conversion (same simplification as before).
      if (alloc.entryType === BusinessEntryType.REVENUE) {
        agg.revenue = agg.revenue.plus(alloc.amount);
      } else if (alloc.entryType === BusinessEntryType.EXPENSE) {
        agg.expenses = agg.expenses.plus(alloc.amount);
      }
      // PASS_THROUGH excluded from card revenue, matching whole-txn behaviour.
    }

    return businesses.map((b) => {
      const agg = aggByBusiness.get(b.id) ?? { revenue: new Prisma.Decimal(0), expenses: new Prisma.Decimal(0) };
      return {
        id: b.id,
        name: b.name,
        note: b.note,
        currencyCode: b.currencyCode,
        startedAt: b.startedAt,
        isActive: b.isActive,
        txnCount: countByBusiness.get(b.id) ?? 0,
        periodRevenue: agg.revenue,
        periodExpenses: agg.expenses,
        periodProfit: agg.revenue.minus(agg.expenses),
      };
    });
  },
);

// ─────────────────────────────────────────────────────────────
// Revenue by stream — month × streamKey matrix
// ─────────────────────────────────────────────────────────────

export type BusinessStreamMatrix = {
  streams: string[];
  months: string[];
  cells: Record<string, Record<string, Prisma.Decimal>>; // cells[streamKey][monthKey]
  streamTotals: Record<string, Prisma.Decimal>;
  monthTotals: Record<string, Prisma.Decimal>;
  grandTotal: Prisma.Decimal;
};

const OTHER_STREAM = "other";

export const getBusinessRevenueByStream = cache(
  async (
    userId: string,
    businessId: string,
    bounds: { from: Date; to: Date },
    baseCcy: string,
  ): Promise<BusinessStreamMatrix> => {
    const [tz, rates] = await Promise.all([getCurrentUserTz(), getLatestRatesMap()]);

    const allocations = await db.businessAllocation.findMany({
      where: {
        userId,
        businessId,
        entryType: BusinessEntryType.REVENUE,
        occurredAt: { gte: bounds.from, lte: bounds.to },
      },
      select: { amount: true, currencyCode: true, streamKey: true, occurredAt: true },
    });

    const tzMonthFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    });

    const months: string[] = [];
    const cursor = startOfMonthUtcInTz(tz, bounds.from);
    while (cursor <= bounds.to) {
      months.push(tzMonthKey(tzMonthFmt, cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const cells: Record<string, Record<string, Prisma.Decimal>> = {};
    const streamTotals: Record<string, Prisma.Decimal> = {};
    const monthTotals: Record<string, Prisma.Decimal> = {};
    for (const m of months) monthTotals[m] = new Prisma.Decimal(0);
    let grandTotal = new Prisma.Decimal(0);

    const streamOrder: string[] = [];

    for (const alloc of allocations) {
      const stream = alloc.streamKey ?? OTHER_STREAM;
      const monthKey = tzMonthKey(tzMonthFmt, alloc.occurredAt);
      const inBase =
        convertToBase(alloc.amount, alloc.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);

      if (!cells[stream]) {
        cells[stream] = {};
        for (const m of months) cells[stream][m] = new Prisma.Decimal(0);
        streamTotals[stream] = new Prisma.Decimal(0);
        streamOrder.push(stream);
      }

      if (cells[stream][monthKey] === undefined) continue; // outside zero-filled range guard

      cells[stream][monthKey] = cells[stream][monthKey].plus(inBase);
      streamTotals[stream] = streamTotals[stream].plus(inBase);
      monthTotals[monthKey] = monthTotals[monthKey].plus(inBase);
      grandTotal = grandTotal.plus(inBase);
    }

    return { streams: streamOrder, months, cells, streamTotals, monthTotals, grandTotal };
  },
);

// ─────────────────────────────────────────────────────────────
// Revenue by tariff — totals + count
// ─────────────────────────────────────────────────────────────

export type BusinessTariffBreakdownRow = {
  tariff: string;
  total: Prisma.Decimal;
  count: number;
};

export const getBusinessRevenueByTariff = cache(
  async (
    userId: string,
    businessId: string,
    bounds: { from: Date; to: Date },
    baseCcy: string,
  ): Promise<BusinessTariffBreakdownRow[]> => {
    const rates = await getLatestRatesMap();

    const allocations = await db.businessAllocation.findMany({
      where: {
        userId,
        businessId,
        entryType: BusinessEntryType.REVENUE,
        occurredAt: { gte: bounds.from, lte: bounds.to },
      },
      select: { amount: true, currencyCode: true, tariff: true },
    });

    const OTHER_TARIFF = "other";
    const map = new Map<string, { total: Prisma.Decimal; count: number }>();

    for (const alloc of allocations) {
      const tariff = alloc.tariff ?? OTHER_TARIFF;
      const inBase =
        convertToBase(alloc.amount, alloc.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
      const row = map.get(tariff) ?? { total: new Prisma.Decimal(0), count: 0 };
      row.total = row.total.plus(inBase);
      row.count += 1;
      map.set(tariff, row);
    }

    return Array.from(map.entries())
      .map(([tariff, row]) => ({ tariff, total: row.total, count: row.count }))
      .sort((a, b) => b.total.comparedTo(a.total));
  },
);

// ─────────────────────────────────────────────────────────────
// Forecast — 6-month forward projection from trailing history
// ─────────────────────────────────────────────────────────────

export type BusinessForecastHistoryPoint = {
  monthKey: string;
  revenue: number;
  expenses: number;
};

export type BusinessForecastProjectionPoint = {
  monthKey: string;
  base: number;
  optimist: number;
  pessimist: number;
  expenses: number;
};

export type BusinessForecast = {
  history: BusinessForecastHistoryPoint[];
  projection: BusinessForecastProjectionPoint[];
};

const FORECAST_HORIZON_MONTHS = 6;
const FORECAST_TRAILING_MONTHS = 3;

/** Advances a "YYYY-MM" monthKey forward by n months (n may be negative). */
function shiftMonthKey(monthKey: string, n: number): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-based
  let m0 = (month - 1) + n;
  const yCarry = Math.floor(m0 / 12);
  m0 = ((m0 % 12) + 12) % 12;
  const y = year + yCarry;
  return `${y}-${String(m0 + 1).padStart(2, "0")}`;
}

export const getBusinessForecast = cache(
  async (
    userId: string,
    businessId: string,
    bounds: { from: Date; to: Date },
    baseCcy: string,
  ): Promise<BusinessForecast> => {
    const pnl = await getBusinessPnL(userId, businessId, bounds, baseCcy);

    const history: BusinessForecastHistoryPoint[] = pnl.rows.map((row) => ({
      monthKey: row.monthKey,
      revenue: Number(row.revenue),
      expenses: Number(row.expenses),
    }));

    const nonZeroMonths = history.filter((h) => h.revenue !== 0 || h.expenses !== 0);
    if (nonZeroMonths.length < 2 || history.length === 0) {
      return { history, projection: [] };
    }

    const trailing = history.slice(-FORECAST_TRAILING_MONTHS);
    const avgRev = trailing.reduce((s, h) => s + h.revenue, 0) / trailing.length;
    const avgExp = trailing.reduce((s, h) => s + h.expenses, 0) / trailing.length;

    // Least-squares slope of revenue over trailing months (index → revenue)
    const n = trailing.length;
    const xs = trailing.map((_, i) => i);
    const ys = trailing.map((h) => h.revenue);
    const xMean = xs.reduce((s, x) => s + x, 0) / n;
    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    const g = den === 0 ? 0 : num / den;

    const lastMonthKey = history[history.length - 1].monthKey;
    const projection: BusinessForecastProjectionPoint[] = [];
    for (let m = 1; m <= FORECAST_HORIZON_MONTHS; m++) {
      projection.push({
        monthKey: shiftMonthKey(lastMonthKey, m),
        base: avgRev,
        optimist: avgRev + Math.max(g, 0) * m,
        pessimist: avgRev * Math.pow(0.85, m),
        expenses: avgExp,
      });
    }

    return { history, projection };
  },
);
