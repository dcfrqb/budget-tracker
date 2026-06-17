import { cache } from "react";
import { db } from "@/lib/db";
import { Prisma, TransactionKind, TransactionStatus, FreelanceOrderStatus, FreelanceOrderStageStatus, WorkKind } from "@prisma/client";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { startOfMonthUtcInTz, periodBounds } from "@/lib/data/_period";
import type { PeriodCode } from "@/lib/data/_period";
import { convertToBase, getLatestRatesMap } from "@/lib/data/wallet";
import { HOURS_PER_MONTH_DEFAULT } from "@/lib/constants";

export type { PeriodCode };

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

// First active WorkSource by createdAt.
export const getPrimaryWorkSource = cache(async (userId: string) => {
  return db.workSource.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
});

export type WorkSourceCardSummary = {
  id: string;
  name: string;
  kind: string;
  currencyCode: string;
  rateType: string | null;
  rateAmount: Prisma.Decimal | null;
  payDay: number | null;
  taxRatePct: Prisma.Decimal | null;
  isActive: boolean;
  note: string | null;
  lastPaymentAt: Date | null;
  lastPaymentAmount: Prisma.Decimal | null;
  mtdTotal: Prisma.Decimal;
  nextExpectedAt: Date | null;
};

// ─────────────────────────────────────────────────────────────
// getWorkSourceCardSummaries — N+1 refactored to batch queries
// ─────────────────────────────────────────────────────────────

export const getWorkSourceCardSummaries = cache(
  async (userId: string): Promise<WorkSourceCardSummary[]> => {
    const tz = await getCurrentUserTz();
    const now = new Date();
    const mtdStart = startOfMonthUtcInTz(tz, now);

    const sources = await db.workSource.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });

    if (sources.length === 0) return [];

    const sourceIds = sources.map((s) => s.id);

    // Batch: all DONE+PARTIAL income txns per source for last payment + MTD
    const allDonePartialTxns = await db.transaction.findMany({
      where: {
        userId,
        workSourceId: { in: sourceIds },
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      },
      orderBy: { occurredAt: "desc" },
      select: {
        workSourceId: true,
        occurredAt: true,
        amount: true,
        status: true,
        facts: { select: { amount: true, occurredAt: true }, orderBy: { occurredAt: "desc" } },
      },
    });

    // Batch: next planned income per source
    const allNextPlanned = await db.transaction.findMany({
      where: {
        userId,
        workSourceId: { in: sourceIds },
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: TransactionStatus.PLANNED,
        occurredAt: { gte: now },
      },
      orderBy: { occurredAt: "asc" },
      select: { workSourceId: true, occurredAt: true },
    });

    // Build per-source maps
    const lastTxnBySource = new Map<string, (typeof allDonePartialTxns)[0]>();
    const mtdTxnsBySource = new Map<string, typeof allDonePartialTxns>();
    const nextPlannedBySource = new Map<string, Date>();

    for (const txn of allDonePartialTxns) {
      if (!txn.workSourceId) continue;
      if (!lastTxnBySource.has(txn.workSourceId)) {
        lastTxnBySource.set(txn.workSourceId, txn);
      }
      if (txn.occurredAt >= mtdStart && txn.occurredAt <= now) {
        const arr = mtdTxnsBySource.get(txn.workSourceId) ?? [];
        arr.push(txn);
        mtdTxnsBySource.set(txn.workSourceId, arr);
      }
    }

    for (const txn of allNextPlanned) {
      if (!txn.workSourceId) continue;
      if (!nextPlannedBySource.has(txn.workSourceId)) {
        nextPlannedBySource.set(txn.workSourceId, txn.occurredAt);
      }
    }

    function effectiveAmount(
      txn: (typeof allDonePartialTxns)[0],
    ): Prisma.Decimal {
      if (txn.status === TransactionStatus.DONE) {
        return new Prisma.Decimal(txn.amount);
      }
      return txn.facts.reduce(
        (s, f) => s.plus(f.amount),
        new Prisma.Decimal(0),
      );
    }

    function effectiveLastPayment(
      txn: (typeof allDonePartialTxns)[0],
    ): { at: Date; amount: Prisma.Decimal } {
      if (txn.status === TransactionStatus.DONE || txn.facts.length === 0) {
        return { at: txn.occurredAt, amount: new Prisma.Decimal(txn.amount) };
      }
      // PARTIAL: use the latest fact
      const latestFact = txn.facts[0]; // already ordered by occurredAt desc
      return {
        at: latestFact.occurredAt,
        amount: new Prisma.Decimal(latestFact.amount),
      };
    }

    return sources.map((ws) => {
      const lastTxn = lastTxnBySource.get(ws.id) ?? null;
      const mtdTxns = mtdTxnsBySource.get(ws.id) ?? [];

      let lastPaymentAt: Date | null = null;
      let lastPaymentAmount: Prisma.Decimal | null = null;
      if (lastTxn) {
        const lp = effectiveLastPayment(lastTxn);
        lastPaymentAt = lp.at;
        lastPaymentAmount = lp.amount;
      }

      let mtdTotal = new Prisma.Decimal(0);
      for (const txn of mtdTxns) {
        mtdTotal = mtdTotal.plus(effectiveAmount(txn));
      }

      return {
        id: ws.id,
        name: ws.name,
        kind: ws.kind,
        currencyCode: ws.currencyCode,
        rateType: ws.rateType,
        rateAmount: ws.rateAmount,
        payDay: ws.payDay,
        taxRatePct: ws.taxRatePct,
        isActive: ws.isActive,
        note: ws.note,
        lastPaymentAt,
        lastPaymentAmount,
        mtdTotal,
        nextExpectedAt: nextPlannedBySource.get(ws.id) ?? null,
      };
    });
  },
);

// ─────────────────────────────────────────────────────────────
// Detail page data functions
// ─────────────────────────────────────────────────────────────

export type WorkSourceDetail = {
  source: Awaited<ReturnType<typeof db.workSource.findFirst>> & object;
  txnCount: number;
  lastTxnAt: Date | null;
  hasLinkedTxns: boolean;
};

export const getWorkSourceWithCounts = cache(
  async (userId: string, id: string): Promise<WorkSourceDetail | null> => {
    const source = await db.workSource.findFirst({ where: { id, userId } });
    if (!source) return null;

    const [txnCount, lastTxn] = await Promise.all([
      db.transaction.count({ where: { workSourceId: id, deletedAt: null } }),
      db.transaction.findFirst({
        where: { workSourceId: id, deletedAt: null },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
    ]);

    return {
      source,
      txnCount,
      lastTxnAt: lastTxn?.occurredAt ?? null,
      hasLinkedTxns: txnCount > 0,
    };
  },
);

export type WorkSourceMonthlyBucket = {
  monthKey: string;
  total: Prisma.Decimal;
};

export const getWorkSourceMonthlySeries = cache(
  async (
    userId: string,
    workSourceId: string,
    bounds: { from: Date; to: Date },
  ): Promise<WorkSourceMonthlyBucket[]> => {
    const tz = await getCurrentUserTz();

    const txns = await db.transaction.findMany({
      where: {
        userId,
        workSourceId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        occurredAt: { gte: bounds.from, lte: bounds.to },
      },
      select: {
        occurredAt: true,
        amount: true,
        status: true,
        facts: { select: { amount: true } },
      },
    });

    // Group by TZ-local YYYY-MM
    const bucketMap = new Map<string, Prisma.Decimal>();

    const tzMonthFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    });

    for (const txn of txns) {
      const parts = tzMonthFmt.formatToParts(txn.occurredAt);
      const yr = parts.find((p) => p.type === "year")!.value;
      const mo = parts.find((p) => p.type === "month")!.value;
      const key = `${yr}-${mo}`;

      const amount =
        txn.status === TransactionStatus.DONE
          ? new Prisma.Decimal(txn.amount)
          : txn.facts.reduce(
              (s, f) => s.plus(f.amount),
              new Prisma.Decimal(0),
            );

      bucketMap.set(key, (bucketMap.get(key) ?? new Prisma.Decimal(0)).plus(amount));
    }

    // Build zero-filled series for all months in the bounds
    const result: WorkSourceMonthlyBucket[] = [];
    const cursor = startOfMonthUtcInTz(tz, bounds.from);
    const end = bounds.to;

    while (cursor <= end) {
      const parts = tzMonthFmt.formatToParts(cursor);
      const yr = parts.find((p) => p.type === "year")!.value;
      const mo = parts.find((p) => p.type === "month")!.value;
      const key = `${yr}-${mo}`;
      result.push({ monthKey: key, total: bucketMap.get(key) ?? new Prisma.Decimal(0) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return result;
  },
);

export type WorkSourceKpis = {
  totalIncome: Prisma.Decimal;
  totalIncomeBase: Prisma.Decimal;
  txnCount: number;
  avgPerMonth: Prisma.Decimal;
  lastPaymentAt: Date | null;
  lastPaymentAmount: Prisma.Decimal | null;
  nextExpectedAt: Date | null;
  nextExpectedAmount: Prisma.Decimal | null;
  estimatedTax: Prisma.Decimal;
  effectiveHourlyRate: Prisma.Decimal | null;
};

export const getWorkSourceKpis = cache(
  async (
    userId: string,
    workSourceId: string,
    bounds: { from: Date; to: Date },
    baseCurrency: string,
  ): Promise<WorkSourceKpis> => {
    const [ws, rates] = await Promise.all([
      db.workSource.findFirst({ where: { id: workSourceId, userId } }),
      getLatestRatesMap(),
    ]);

    const txns = await db.transaction.findMany({
      where: {
        userId,
        workSourceId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        occurredAt: { gte: bounds.from, lte: bounds.to },
      },
      orderBy: { occurredAt: "desc" },
      select: {
        occurredAt: true,
        amount: true,
        currencyCode: true,
        status: true,
        facts: { select: { amount: true } },
      },
    });

    let totalIncome = new Prisma.Decimal(0);
    let totalIncomeBase = new Prisma.Decimal(0);
    let lastPaymentAt: Date | null = null;
    let lastPaymentAmount: Prisma.Decimal | null = null;

    for (const txn of txns) {
      const amount =
        txn.status === TransactionStatus.DONE
          ? new Prisma.Decimal(txn.amount)
          : txn.facts.reduce(
              (s, f) => s.plus(f.amount),
              new Prisma.Decimal(0),
            );

      totalIncome = totalIncome.plus(amount);

      const inBase = convertToBase(amount, txn.currencyCode, baseCurrency, rates);
      if (inBase) totalIncomeBase = totalIncomeBase.plus(inBase);

      if (!lastPaymentAt) {
        lastPaymentAt = txn.occurredAt;
        lastPaymentAmount = amount;
      }
    }

    // Next planned
    const nextTxn = await db.transaction.findFirst({
      where: {
        userId,
        workSourceId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: TransactionStatus.PLANNED,
        occurredAt: { gte: new Date() },
      },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true, amount: true },
    });

    const numMonths = Math.max(
      1,
      Math.ceil(
        (bounds.to.getTime() - bounds.from.getTime()) /
          (1000 * 60 * 60 * 24 * 30),
      ),
    );

    const avgPerMonth = totalIncome.div(numMonths);

    const taxRatePct = ws?.taxRatePct ? new Prisma.Decimal(ws.taxRatePct) : new Prisma.Decimal(0);
    const estimatedTax = totalIncome.times(taxRatePct).div(100);

    // Effective hourly rate
    let effectiveHourlyRate: Prisma.Decimal | null = null;
    if (ws) {
      const hoursPerMonth = ws.hoursPerMonth ?? HOURS_PER_MONTH_DEFAULT;
      if (ws.rateType === "HOURLY" && ws.rateAmount) {
        effectiveHourlyRate = new Prisma.Decimal(ws.rateAmount);
      } else if (ws.rateType === "MONTHLY" && ws.rateAmount) {
        effectiveHourlyRate = new Prisma.Decimal(ws.rateAmount).div(hoursPerMonth);
      } else if (ws.rateType === "DAILY" && ws.rateAmount) {
        effectiveHourlyRate = new Prisma.Decimal(ws.rateAmount).div(8);
      } else if (ws.kind === WorkKind.FREELANCE) {
        // Fallback: derive from orders where both amount and hours are recorded
        const orders = await db.freelanceOrder.findMany({
          where: {
            workSourceId,
            userId,
            amount: { gt: 0 },
            hours: { not: null },
            performedAt: { gte: bounds.from, lte: bounds.to },
          },
          select: { amount: true, hours: true },
        });
        let sumAmount = new Prisma.Decimal(0);
        let sumHours = new Prisma.Decimal(0);
        for (const o of orders) {
          if (o.hours && !new Prisma.Decimal(o.hours).isZero()) {
            sumAmount = sumAmount.plus(o.amount);
            sumHours = sumHours.plus(o.hours);
          }
        }
        if (!sumHours.isZero()) {
          effectiveHourlyRate = sumAmount.div(sumHours);
        }
      }
    }

    return {
      totalIncome,
      totalIncomeBase,
      txnCount: txns.length,
      avgPerMonth,
      lastPaymentAt,
      lastPaymentAmount,
      nextExpectedAt: nextTxn?.occurredAt ?? null,
      nextExpectedAmount: nextTxn ? new Prisma.Decimal(nextTxn.amount) : null,
      estimatedTax,
      effectiveHourlyRate,
    };
  },
);

export type WorkSourceTransaction = Awaited<
  ReturnType<typeof getWorkSourceTransactions>
>[number];

export const getWorkSourceTransactions = cache(
  async (
    userId: string,
    workSourceId: string,
    bounds: { from: Date; to: Date },
    statusFilter?: TransactionStatus[],
  ) => {
    return db.transaction.findMany({
      where: {
        userId,
        workSourceId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        ...(statusFilter ? { status: { in: statusFilter } } : {}),
        occurredAt: { gte: bounds.from, lte: bounds.to },
      },
      orderBy: { occurredAt: "desc" },
      include: {
        account: true,
        category: true,
        facts: { select: { amount: true } },
      },
    });
  },
);

export type WorkSourceFreelanceOrder = Awaited<
  ReturnType<typeof getWorkSourceFreelanceOrders>
>[number];

export const getWorkSourceFreelanceOrders = cache(
  async (
    userId: string,
    workSourceId: string,
    bounds: { from: Date; to: Date },
  ) => {
    const orders = await db.freelanceOrder.findMany({
      where: {
        userId,
        workSourceId,
        OR: [
          { performedAt: { gte: bounds.from, lte: bounds.to } },
          { paidAt: { gte: bounds.from, lte: bounds.to } },
          { performedAt: null, paidAt: null },
        ],
      },
      orderBy: [
        { performedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      include: {
        stages: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (orders.length === 0) return orders.map((o) => ({ ...o, paidSum: new Prisma.Decimal(0), paidCount: 0, paidCountOtherCcy: 0 }));

    const orderIds = orders.map((o) => o.id);
    const linkedTxns = await db.transaction.findMany({
      where: {
        freelanceOrderId: { in: orderIds },
        userId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      },
      select: {
        freelanceOrderId: true,
        amount: true,
        status: true,
        currencyCode: true,
        facts: { select: { amount: true } },
      },
    });

    type TxnAgg = { paidSum: Prisma.Decimal; paidCount: number; paidCountOtherCcy: number };
    const aggMap = new Map<string, TxnAgg>();
    for (const orderId of orderIds) {
      aggMap.set(orderId, { paidSum: new Prisma.Decimal(0), paidCount: 0, paidCountOtherCcy: 0 });
    }

    const orderCcyMap = new Map(orders.map((o) => [o.id, o.currencyCode]));

    // Orders with stages: received = sum of stage paidAmounts (PAID stages only)
    const orderIdsWithStages = new Set(orders.filter((o) => o.stages.length > 0).map((o) => o.id));
    for (const o of orders) {
      if (!orderIdsWithStages.has(o.id)) continue;
      const agg = aggMap.get(o.id)!;
      for (const stage of o.stages) {
        if (stage.status === FreelanceOrderStageStatus.PAID && stage.paidAmount != null) {
          agg.paidSum = agg.paidSum.plus(new Prisma.Decimal(stage.paidAmount));
          agg.paidCount += 1;
        }
      }
    }

    // Orders without stages: received = linked txns (existing logic)
    for (const txn of linkedTxns) {
      if (!txn.freelanceOrderId) continue;
      if (orderIdsWithStages.has(txn.freelanceOrderId)) continue;
      const agg = aggMap.get(txn.freelanceOrderId);
      if (!agg) continue;

      const orderCcy = orderCcyMap.get(txn.freelanceOrderId);
      if (txn.currencyCode !== orderCcy) {
        agg.paidCountOtherCcy += 1;
        continue;
      }

      const effectiveAmt =
        txn.status === TransactionStatus.DONE
          ? new Prisma.Decimal(txn.amount)
          : txn.facts.reduce((s, f) => s.plus(f.amount), new Prisma.Decimal(0));

      agg.paidSum = agg.paidSum.plus(effectiveAmt);
      agg.paidCount += 1;
    }

    return orders.map((o) => {
      const agg = aggMap.get(o.id) ?? { paidSum: new Prisma.Decimal(0), paidCount: 0, paidCountOtherCcy: 0 };
      return { ...o, ...agg };
    });
  },
);

export type CandidateTxnForOrder = {
  id: string;
  occurredAt: Date;
  amount: Prisma.Decimal;
  name: string;
  currencyCode: string;
  accountId: string | null;
};

export const getCandidateTxnsForOrder = cache(
  async (
    userId: string,
    workSourceId: string,
    bounds: { from: Date; to: Date },
  ): Promise<CandidateTxnForOrder[]> => {
    const rows = await db.transaction.findMany({
      where: {
        userId,
        workSourceId,
        freelanceOrderId: null,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        occurredAt: { gte: bounds.from, lte: bounds.to },
      },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        occurredAt: true,
        amount: true,
        name: true,
        currencyCode: true,
        accountId: true,
      },
    });
    return rows.map((r) => ({ ...r, amount: new Prisma.Decimal(r.amount) }));
  },
);

export type EmploymentMonthRow = {
  monthKey: string;
  expected: Prisma.Decimal | null;
  actual: Prisma.Decimal;
  delta: Prisma.Decimal;
};

export const getEmploymentMonthlyPlanFact = cache(
  async (
    userId: string,
    workSourceId: string,
    bounds: { from: Date; to: Date },
  ): Promise<EmploymentMonthRow[]> => {
    const ws = await db.workSource.findFirst({
      where: { id: workSourceId, userId },
    });

    const series = await getWorkSourceMonthlySeries(userId, workSourceId, bounds);

    // Expected per month = rateAmount (if MONTHLY) + premiumAmount
    const rateAmount = ws?.rateType === "MONTHLY" && ws.rateAmount
      ? new Prisma.Decimal(ws.rateAmount)
      : null;
    const premiumAmount = ws?.premiumAmount
      ? new Prisma.Decimal(ws.premiumAmount)
      : new Prisma.Decimal(0);
    const expected = rateAmount ? rateAmount.plus(premiumAmount) : null;

    return series.map((bucket) => ({
      monthKey: bucket.monthKey,
      expected,
      actual: bucket.total,
      delta: expected ? bucket.total.minus(expected) : bucket.total,
    }));
  },
);

// ─────────────────────────────────────────────────────────────
// Freelance latency KPIs
// ─────────────────────────────────────────────────────────────

export type FreelanceLatencyKpis = {
  avgDaysToPay: number | null;
  latePaymentStreak: number;
};

export const getFreelanceLatencyKpis = cache(
  async (
    userId: string,
    workSourceId: string,
    bounds: { from: Date; to: Date },
  ): Promise<FreelanceLatencyKpis> => {
    const orders = await db.freelanceOrder.findMany({
      where: {
        userId,
        workSourceId,
        status: FreelanceOrderStatus.COMPLETED,
        performedAt: { gte: bounds.from, lte: bounds.to },
        paidAt: { not: null },
      },
      orderBy: { performedAt: "desc" },
      select: { performedAt: true, paidAt: true },
    });

    const qualifying = orders.filter(
      (o) => o.performedAt != null && o.paidAt != null,
    ) as Array<{ performedAt: Date; paidAt: Date }>;

    if (qualifying.length === 0) {
      return { avgDaysToPay: null, latePaymentStreak: 0 };
    }

    const MS_PER_DAY = 86_400_000;
    const LATE_THRESHOLD_DAYS = 14;

    let totalDays = 0;
    for (const o of qualifying) {
      totalDays += (o.paidAt.getTime() - o.performedAt.getTime()) / MS_PER_DAY;
    }
    const avgDaysToPay =
      Math.round((totalDays / qualifying.length) * 10) / 10;

    let latePaymentStreak = 0;
    for (const o of qualifying) {
      const days =
        (o.paidAt.getTime() - o.performedAt.getTime()) / MS_PER_DAY;
      if (days > LATE_THRESHOLD_DAYS) {
        latePaymentStreak++;
      } else {
        break;
      }
    }

    return { avgDaysToPay, latePaymentStreak };
  },
);

// ─────────────────────────────────────────────────────────────
// Synthetic forecast (employment, MONTHLY, next N paydays)
// ─────────────────────────────────────────────────────────────

export type SyntheticForecastEntry = {
  expectedAt: Date;
  amount: Prisma.Decimal;
  currencyCode: string;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export const getSyntheticForecast = cache(
  async (
    userId: string,
    workSourceId: string,
    count: number = 3,
  ): Promise<SyntheticForecastEntry[]> => {
    const ws = await db.workSource.findFirst({
      where: { id: workSourceId, userId },
    });

    if (
      !ws ||
      ws.kind !== "EMPLOYMENT" ||
      ws.rateType !== "MONTHLY" ||
      !ws.rateAmount ||
      !ws.payDay
    ) {
      return [];
    }

    const tz = await getCurrentUserTz();
    const now = new Date();
    const amount = ws.premiumAmount
      ? new Prisma.Decimal(ws.rateAmount).plus(ws.premiumAmount)
      : new Prisma.Decimal(ws.rateAmount);

    const result: SyntheticForecastEntry[] = [];
    const payDay = ws.payDay;

    const nowLocal = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const [localYear, localMonth, localDay] = nowLocal
      .split("-")
      .map(Number) as [number, number, number];

    let year = localYear;
    let month = localMonth - 1; // 0-indexed

    const clampedDay = Math.min(payDay, daysInMonth(year, month));
    if (localDay >= clampedDay) {
      month += 1;
      if (month > 11) { month = 0; year += 1; }
    }

    while (result.length < count) {
      const dim = daysInMonth(year, month);
      const day = Math.min(payDay, dim);
      const expectedAt = new Date(
        Date.UTC(year, month, day),
      );
      result.push({ expectedAt, amount, currencyCode: ws.currencyCode });
      month += 1;
      if (month > 11) { month = 0; year += 1; }
    }

    return result;
  },
);

// ─────────────────────────────────────────────────────────────
// Order status breakdown (for freelance detail page chart)
// ─────────────────────────────────────────────────────────────

export type OrderStatusBreakdownRow = {
  status: FreelanceOrderStatus;
  count: number;
  total: Prisma.Decimal;
};

const FREELANCE_STATUS_ORDER: FreelanceOrderStatus[] = [
  FreelanceOrderStatus.PLANNED,
  FreelanceOrderStatus.ACTIVE,
  FreelanceOrderStatus.AWAITING_PAYMENT,
  FreelanceOrderStatus.COMPLETED,
  FreelanceOrderStatus.CANCELLED,
];

export const getFreelanceOrderStatusBreakdown = cache(
  async (
    userId: string,
    workSourceId: string,
    bounds: { from: Date; to: Date },
  ): Promise<OrderStatusBreakdownRow[]> => {
    const orders = await db.freelanceOrder.findMany({
      where: {
        userId,
        workSourceId,
        OR: [
          { performedAt: { gte: bounds.from, lte: bounds.to } },
          { paidAt: { gte: bounds.from, lte: bounds.to } },
          { performedAt: null, paidAt: null },
        ],
      },
      select: { status: true, amount: true },
    });

    const map = new Map<FreelanceOrderStatus, { count: number; total: Prisma.Decimal }>();
    for (const status of FREELANCE_STATUS_ORDER) {
      map.set(status, { count: 0, total: new Prisma.Decimal(0) });
    }

    for (const o of orders) {
      const entry = map.get(o.status)!;
      entry.count += 1;
      entry.total = entry.total.plus(o.amount);
    }

    return FREELANCE_STATUS_ORDER.map((status) => {
      const { count, total } = map.get(status)!;
      return { status, count, total };
    });
  },
);

// ─────────────────────────────────────────────────────────────
// Source comparison rows (for income index page chart)
// ─────────────────────────────────────────────────────────────

export type SourceComparisonRow = {
  id: string;
  name: string;
  kind: WorkKind;
  currencyCode: string;
  totalNative: Prisma.Decimal;
  totalBase: Prisma.Decimal;
};

export const getSourceComparisonRows = cache(
  async (
    userId: string,
    bounds: { from: Date; to: Date },
    baseCurrency: string,
  ): Promise<SourceComparisonRow[]> => {
    const [sources, rates] = await Promise.all([
      db.workSource.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      getLatestRatesMap(),
    ]);

    if (sources.length === 0) return [];

    const sourceIds = sources.map((s) => s.id);

    const txns = await db.transaction.findMany({
      where: {
        userId,
        workSourceId: { in: sourceIds },
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        occurredAt: { gte: bounds.from, lte: bounds.to },
      },
      select: {
        workSourceId: true,
        amount: true,
        currencyCode: true,
        status: true,
        facts: { select: { amount: true } },
      },
    });

    const nativeBySource = new Map<string, Prisma.Decimal>();
    const baseBySource = new Map<string, Prisma.Decimal>();

    for (const txn of txns) {
      if (!txn.workSourceId) continue;

      const native =
        txn.status === TransactionStatus.DONE
          ? new Prisma.Decimal(txn.amount)
          : txn.facts.reduce(
              (s, f) => s.plus(f.amount),
              new Prisma.Decimal(0),
            );

      nativeBySource.set(
        txn.workSourceId,
        (nativeBySource.get(txn.workSourceId) ?? new Prisma.Decimal(0)).plus(native),
      );

      // Sources whose currency has no rate get totalBase=0 and sort to the bottom;
      // native total stays accurate via nativeBySource.
      const inBase = convertToBase(native, txn.currencyCode, baseCurrency, rates);
      if (inBase) {
        baseBySource.set(
          txn.workSourceId,
          (baseBySource.get(txn.workSourceId) ?? new Prisma.Decimal(0)).plus(inBase),
        );
      }
    }

    const rows: SourceComparisonRow[] = sources.map((ws) => ({
      id: ws.id,
      name: ws.name,
      kind: ws.kind,
      currencyCode: ws.currencyCode,
      totalNative: nativeBySource.get(ws.id) ?? new Prisma.Decimal(0),
      totalBase: baseBySource.get(ws.id) ?? new Prisma.Decimal(0),
    }));

    return rows.sort((a, b) =>
      b.totalBase.comparedTo(a.totalBase),
    );
  },
);

// Re-export for backward compat with income/page.tsx imports
export { periodBounds, startOfMonthUtcInTz };

