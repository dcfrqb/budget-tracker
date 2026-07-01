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

    const [txnCount, lastTxn] = await Promise.all([
      db.transaction.count({ where: { businessId: id, deletedAt: null } }),
      db.transaction.findFirst({
        where: { businessId: id, deletedAt: null },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
    ]);

    return {
      business,
      txnCount,
      lastTxnAt: lastTxn?.occurredAt ?? null,
      hasLinkedTxns: txnCount > 0,
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

export const getBusinessPnL = cache(
  async (
    userId: string,
    businessId: string,
    bounds: { from: Date; to: Date },
    baseCcy: string,
  ): Promise<BusinessPnL> => {
    const [tz, rates] = await Promise.all([getCurrentUserTz(), getLatestRatesMap()]);

    const txns = await db.transaction.findMany({
      where: {
        userId,
        businessId,
        deletedAt: null,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        occurredAt: { gte: bounds.from, lte: bounds.to },
      },
      select: {
        occurredAt: true,
        kind: true,
        amount: true,
        currencyCode: true,
        status: true,
        businessEntryType: true,
        facts: { select: { amount: true } },
      },
    });

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

    for (const txn of txns) {
      const parts = tzMonthFmt.formatToParts(txn.occurredAt);
      const yr = parts.find((p) => p.type === "year")!.value;
      const mo = parts.find((p) => p.type === "month")!.value;
      const key = `${yr}-${mo}`;

      const native = effectiveTxnAmount(txn);
      const inBase = convertToBase(native, txn.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);

      const bucket = bucketMap.get(key) ?? {
        revenue: new Prisma.Decimal(0),
        passThrough: new Prisma.Decimal(0),
        expenses: new Prisma.Decimal(0),
      };

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

      bucketMap.set(key, bucket);
    }

    totals.profit = totals.revenue.minus(totals.expenses);

    // Zero-fill every month in bounds
    const rows: BusinessPnLRow[] = [];
    const cursor = startOfMonthUtcInTz(tz, bounds.from);
    const end = bounds.to;

    while (cursor <= end) {
      const parts = tzMonthFmt.formatToParts(cursor);
      const yr = parts.find((p) => p.type === "year")!.value;
      const mo = parts.find((p) => p.type === "month")!.value;
      const key = `${yr}-${mo}`;
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

    const txns = await db.transaction.findMany({
      where: {
        userId,
        businessId: { in: businessIds },
        deletedAt: null,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        occurredAt: { gte: periodStart, lte: now },
      },
      select: {
        businessId: true,
        kind: true,
        amount: true,
        status: true,
        businessEntryType: true,
        facts: { select: { amount: true } },
      },
    });

    const allTxnCounts = await db.transaction.groupBy({
      by: ["businessId"],
      where: { userId, businessId: { in: businessIds }, deletedAt: null },
      _count: { _all: true },
    });
    const countByBusiness = new Map(allTxnCounts.map((r) => [r.businessId as string, r._count._all]));

    type Agg = { revenue: Prisma.Decimal; expenses: Prisma.Decimal };
    const aggByBusiness = new Map<string, Agg>();
    for (const id of businessIds) {
      aggByBusiness.set(id, { revenue: new Prisma.Decimal(0), expenses: new Prisma.Decimal(0) });
    }

    for (const txn of txns) {
      if (!txn.businessId) continue;
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
