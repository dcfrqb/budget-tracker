import { cache } from "react";
import { Prisma, TransactionKind, TransactionStatus, BudgetMode } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getLatestRatesMap,
  convertToBase,
} from "@/lib/data/wallet";
import { getLoans } from "@/lib/data/loans";
import { getSubscriptions } from "@/lib/data/subscriptions";
import { getFundsWithProgress } from "@/lib/data/funds";
import { getPlannedEvents } from "@/lib/data/planned-events";
import { computeAmortization } from "@/lib/amortization";
import { computeSafeUntil } from "@/lib/forecast";
import { getAvailableNow } from "@/lib/data/_shared/period-aggregates";
import { getCompensationProjection } from "@/lib/data/_shared/compensation-projection";
import { getBudgetSettings } from "@/lib/data/settings";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type DashboardStatus = "stable" | "warning" | "crisis";

export type UpcomingObligation = {
  id: string;
  kind: "subscription" | "loan" | "planned" | "debt" | "credit_card";
  label: string;
  amountBase: string;
  currencyCode: string;
  amount: string;
  dueAt: string; // ISO date
};

export type TopCategoryDelta = {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  currentMonthBase: string;
  prevMonthBase: string;
  deltaPct: number | null; // null если prev = 0
};

export type HomeDashboard = {
  status: DashboardStatus;
  budgetMode: BudgetMode;
  balances: Array<{
    currencyCode: string;
    amount: string;
    amountBase: string;
  }>;
  totalBalanceBase: string;
  safeUntilDays: number | null;
  reservedBase: string;
  freeBase: string;
  liquidBase: string;
  planFactMonth: {
    inflowPlanBase: string;
    inflowFactBase: string;
    outflowPlanBase: string;
    outflowFactBase: string;
    hasInflowPlan: boolean;
    hasOutflowPlan: boolean;
  };
  upcomingObligations30d: UpcomingObligation[];
  topCategoriesDelta: TopCategoryDelta[];
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

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

/** Фактически подтверждённая сумма транзакции (DONE → amount, PARTIAL → сумма facts). */
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
// Period helpers
// ─────────────────────────────────────────────────────────────

export type HomePeriod = "7d" | "30d" | "90d" | "1y";

export function parseHomePeriod(raw: string | undefined): HomePeriod {
  if (raw === "7d" || raw === "30d" || raw === "90d" || raw === "1y") return raw;
  return "30d";
}

function periodToDays(p: HomePeriod): number {
  return p === "7d" ? 7 : p === "30d" ? 30 : p === "90d" ? 90 : 365;
}

// ─────────────────────────────────────────────────────────────
// Main aggregator
// ─────────────────────────────────────────────────────────────

export const getHomeDashboard = cache(async (
  userId: string,
  baseCcy: string,
  period: HomePeriod = "30d",
): Promise<HomeDashboard> => {
  const now = new Date();
  const periodDays = periodToDays(period);
  const window30End = addDays(now, 30);
  const periodStart = addDays(now, -periodDays);
  const periodEnd = now;
  // Keep calendar-month aliases for top-category delta (always compares current vs prev month)
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prev30Start = periodStart;

  // ── Параллельные запросы ──────────────────────────────────
  const [
    availableNow,
    rates,
    budgetSettings,
    subs,
    // Топ категорий: текущий и предыдущий месяц
    prevMonthStart,
    prevMonthEnd,
    categories,
    proj,
  ] = await Promise.all([
    getAvailableNow(userId, baseCcy, now),
    getLatestRatesMap(),
    getBudgetSettings(userId),
    getSubscriptions(userId),
    // prevMonthStart / prevMonthEnd — Date objects
    Promise.resolve(startOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))),
    Promise.resolve(endOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))),
    db.category.findMany({
      where: { userId, kind: "EXPENSE", archivedAt: null },
      select: { id: true, name: true, icon: true },
    }),
    getCompensationProjection(userId),
  ]);

  // Destructure from the canonical getAvailableNow helper (single source of truth)
  const { totalBase: totalBalanceBase, reservedBase, freeBase, liquidBase, perCurrencyRows } = availableNow;

  // Build balances array for display from per-currency rows
  const balances: HomeDashboard["balances"] = perCurrencyRows.map(({ ccy, balance }) => {
    const inBase = convertToBase(balance, ccy, baseCcy, rates);
    return {
      currencyCode: ccy,
      amount: balance.toString(),
      amountBase: (inBase ?? new Prisma.Decimal(0)).toString(),
    };
  });

  // Fetch remaining data needed for obligations/avgDailySpend (cached — no duplicate I/O)
  const [loans, funds, plannedEvents30d] = await Promise.all([
    getLoans(userId),
    getFundsWithProgress(userId),
    getPlannedEvents(userId, { from: now, to: window30End }),
  ]);

  // currentMonthTxns and last30TxnsRaw fetched after proj so whereExcludeNonMain is available
  // planFactMonth is ALWAYS current calendar month; period selector does not affect it.
  const [currentMonthTxns, last30TxnsRaw] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: monthStart, lte: monthEnd },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
        transferId: null,
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
    }),
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: periodStart, lte: periodEnd },
        kind: TransactionKind.EXPENSE,
        transferId: null,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        ...proj.whereExcludeNonMain,
      },
      select: {
        id: true,
        status: true,
        amount: true,
        currencyCode: true,
        compensationGroupId: true,
        facts: { select: { amount: true } },
      },
    }),
  ]);


  // ── avgDailySpend (последние 30д) ─────────────────────────
  // Non-main compensation members already excluded at DB level via whereExcludeNonMain
  let totalExpenseLast30 = new Prisma.Decimal(0);
  for (const t of last30TxnsRaw) {
    const override = proj.rewriteAmount(t.id);
    if (override) {
      // Compensation main: nettoBase is already in baseCcy, sign -1 = expense dominates
      if (override.sign === -1) totalExpenseLast30 = totalExpenseLast30.plus(override.netBase);
    } else {
      const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
      const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
      if (inBase) totalExpenseLast30 = totalExpenseLast30.plus(inBase);
    }
  }
  const avgDailySpend = totalExpenseLast30.div(periodDays);

  // ── Upcoming inflow/outflow 30d (PLANNED transactions) ───
  const plannedTxns30d = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: now, lte: window30End },
      status: TransactionStatus.PLANNED,
      kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
      transferId: null,
    },
    select: { kind: true, amount: true, currencyCode: true },
  });

  let upcomingInflow30dBase = new Prisma.Decimal(0);
  let upcomingOutflow30dBase = new Prisma.Decimal(0);
  for (const t of plannedTxns30d) {
    const inBase = convertToBase(t.amount, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;
    if (t.kind === TransactionKind.INCOME) upcomingInflow30dBase = upcomingInflow30dBase.plus(inBase);
    else upcomingOutflow30dBase = upcomingOutflow30dBase.plus(inBase);
  }

  // reservedBase, freeBase, liquidBase come from getAvailableNow (single source of truth).

  // Credit card accounts — still needed for the obligations display list
  const creditAccounts = await db.account.findMany({
    where: {
      userId,
      kind: "CREDIT",
      deletedAt: null,
      OR: [
        { minPaymentFixed: { not: null } },
        { minPaymentPercent: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      currencyCode: true,
      debtBalance: true,
      minPaymentFixed: true,
      minPaymentPercent: true,
      paymentDueDay: true,
      statementDay: true,
    },
  });

  const safeUntilDays = computeSafeUntil({
    totalBalanceBase,
    avgDailySpendBase: avgDailySpend,
    upcomingInflow30dBase,
    upcomingOutflow30dBase,
  });

  // ── Status heuristic ─────────────────────────────────────
  let status: DashboardStatus = "stable";
  if (freeBase.lte(0)) {
    status = "crisis";
  } else if (safeUntilDays !== null && safeUntilDays < 14) {
    status = "warning";
  }

  // ── Plan/Fact month ──────────────────────────────────────
  let inflowPlanBase = new Prisma.Decimal(0);
  let inflowFactBase = new Prisma.Decimal(0);
  let outflowPlanBase = new Prisma.Decimal(0);
  let outflowFactBase = new Prisma.Decimal(0);

  for (const t of currentMonthTxns) {
    const override = proj.rewriteAmount(t.id);

    if (t.kind === TransactionKind.INCOME) {
      if (override) {
        // Main leg of a compensation group (income-winning): use netto already in baseCcy
        inflowPlanBase = inflowPlanBase.plus(override.netBase);
        if (t.status === TransactionStatus.DONE || t.status === TransactionStatus.PARTIAL) {
          inflowFactBase = inflowFactBase.plus(override.netBase);
        }
      } else {
        const raw = new Prisma.Decimal(t.amount);
        const inBase = convertToBase(raw, t.currencyCode, baseCcy, rates);
        if (!inBase) continue;
        inflowPlanBase = inflowPlanBase.plus(inBase);
        if (t.status === TransactionStatus.DONE || t.status === TransactionStatus.PARTIAL) {
          const confirmed = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
          const confirmedBase = convertToBase(confirmed, t.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
          inflowFactBase = inflowFactBase.plus(confirmedBase);
        }
      }
    } else if (t.kind === TransactionKind.EXPENSE) {
      if (override) {
        // Main leg of a compensation group: use netto already in baseCcy
        outflowPlanBase = outflowPlanBase.plus(override.netBase);
        if (t.status === TransactionStatus.DONE || t.status === TransactionStatus.PARTIAL) {
          outflowFactBase = outflowFactBase.plus(override.netBase);
        }
      } else {
        const raw = new Prisma.Decimal(t.amount);
        const inBase = convertToBase(raw, t.currencyCode, baseCcy, rates);
        if (!inBase) continue;
        outflowPlanBase = outflowPlanBase.plus(inBase);
        if (t.status === TransactionStatus.DONE || t.status === TransactionStatus.PARTIAL) {
          const confirmed = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
          const confirmedBase = convertToBase(confirmed, t.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
          outflowFactBase = outflowFactBase.plus(confirmedBase);
        }
      }
    }
  }

  // ── Upcoming Obligations 30d ──────────────────────────────
  const obligations: UpcomingObligation[] = [];

  for (const sub of subs) {
    if (sub.nextPaymentDate <= window30End) {
      const inBase = convertToBase(sub.price, sub.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
      obligations.push({
        id: sub.id,
        kind: "subscription",
        label: sub.name,
        amountBase: inBase.toString(),
        currencyCode: sub.currencyCode,
        amount: sub.price.toString(),
        dueAt: sub.nextPaymentDate.toISOString(),
      });
    }
  }

  for (const loan of loans) {
    const paidCount = loan.payments.length;
    const schedule = computeAmortization({
      principal: new Prisma.Decimal(loan.principal),
      annualRatePct: new Prisma.Decimal(loan.annualRatePct),
      termMonths: loan.termMonths,
      startDate: loan.startDate,
    });
    const nextRow = schedule.find((r) => r.n > paidCount && r.date >= now && r.date <= window30End);
    if (nextRow) {
      const inBase = convertToBase(nextRow.payment, loan.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
      obligations.push({
        id: loan.id,
        kind: "loan",
        label: loan.name,
        amountBase: inBase.toString(),
        currencyCode: loan.currencyCode,
        amount: nextRow.payment.toString(),
        dueAt: nextRow.date.toISOString(),
      });
    }
  }

  for (const ev of plannedEvents30d) {
    if (ev.expectedAmount && ev.currencyCode) {
      const inBase = convertToBase(ev.expectedAmount, ev.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
      obligations.push({
        id: ev.id,
        kind: "planned",
        label: ev.name,
        amountBase: inBase.toString(),
        currencyCode: ev.currencyCode,
        amount: ev.expectedAmount.toString(),
        dueAt: ev.eventDate.toISOString(),
      });
    }
  }

  // Личные долги с dueAt в окне
  const debts = await db.personalDebt.findMany({
    where: {
      userId,
      closedAt: null,
      dueAt: { gte: now, lte: window30End },
    },
    select: {
      id: true,
      counterparty: true,
      principal: true,
      currencyCode: true,
      dueAt: true,
    },
  });

  for (const debt of debts) {
    if (!debt.dueAt) continue;
    const inBase = convertToBase(debt.principal, debt.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
    obligations.push({
      id: debt.id,
      kind: "debt",
      label: debt.counterparty,
      amountBase: inBase.toString(),
      currencyCode: debt.currencyCode,
      amount: debt.principal.toString(),
      dueAt: debt.dueAt.toISOString(),
    });
  }

  // Add credit card minimum payments as obligations (computed earlier with creditAccounts)
  for (const card of creditAccounts) {
    const fixed = card.minPaymentFixed ? new Prisma.Decimal(card.minPaymentFixed) : null;
    const debt = card.debtBalance ? new Prisma.Decimal(card.debtBalance) : new Prisma.Decimal(0);
    const pctAmount = card.minPaymentPercent ? debt.mul(card.minPaymentPercent).div(100) : null;

    let effectiveAmount: Prisma.Decimal | null = null;
    if (fixed !== null && pctAmount !== null) {
      effectiveAmount = fixed.greaterThan(pctAmount) ? fixed : pctAmount;
    } else if (fixed !== null) {
      effectiveAmount = fixed;
    } else if (pctAmount !== null) {
      effectiveAmount = pctAmount;
    }
    if (!effectiveAmount || effectiveAmount.lte(0)) continue;

    let nextDueDate: Date | null = null;
    if (card.paymentDueDay) {
      const day = card.paymentDueDay;
      const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
      nextDueDate = candidate >= now ? candidate : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day));
    } else if (card.statementDay) {
      const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), card.statementDay + 20));
      nextDueDate = candidate >= now ? candidate : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, card.statementDay + 20));
    }
    if (!nextDueDate || nextDueDate > window30End) continue;

    const inBase = convertToBase(effectiveAmount, card.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);
    obligations.push({
      id: card.id,
      kind: "credit_card",
      label: card.name,
      amountBase: inBase.toString(),
      currencyCode: card.currencyCode,
      amount: effectiveAmount.toString(),
      dueAt: nextDueDate.toISOString(),
    });
  }

  obligations.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const upcomingObligations30d = obligations.slice(0, 20);

  // ── Top categories delta ──────────────────────────────────
  // Текущий месяц — EXPENSE DONE+PARTIAL
  const currentMonthCatTxns = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: TransactionKind.EXPENSE,
      transferId: null,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      occurredAt: { gte: monthStart, lte: monthEnd },
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

  // Предыдущий месяц
  const prevMonthCatTxns = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: TransactionKind.EXPENSE,
      transferId: null,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      occurredAt: { gte: prevMonthStart, lte: prevMonthEnd },
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
  const currentByCat = new Map<string, Prisma.Decimal>();
  for (const t of currentMonthCatTxns) {
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
    currentByCat.set(catId, (currentByCat.get(catId) ?? new Prisma.Decimal(0)).plus(inBase));
  }

  const prevByCat = new Map<string, Prisma.Decimal>();
  for (const t of prevMonthCatTxns) {
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
    prevByCat.set(catId, (prevByCat.get(catId) ?? new Prisma.Decimal(0)).plus(inBase));
  }

  // Top-6 по currentMonthBase
  const sortedCats = [...currentByCat.entries()]
    .sort((a, b) => b[1].comparedTo(a[1]))
    .slice(0, 6);

  const topCategoriesDelta: TopCategoryDelta[] = sortedCats.map(([catId, currentBase]) => {
    const cat = catMap.get(catId);
    const prevBase = prevByCat.get(catId) ?? new Prisma.Decimal(0);
    let deltaPct: number | null = null;
    if (!prevBase.isZero()) {
      deltaPct = currentBase.minus(prevBase).div(prevBase).times(100).toNumber();
    }
    return {
      categoryId: catId,
      categoryName: cat?.name ?? "—",
      icon: cat?.icon ?? null,
      currentMonthBase: currentBase.toString(),
      prevMonthBase: prevBase.toString(),
      deltaPct,
    };
  });

  return {
    status,
    budgetMode: budgetSettings?.activeMode ?? BudgetMode.NORMAL,
    balances,
    totalBalanceBase: totalBalanceBase.toString(),
    safeUntilDays,
    reservedBase: reservedBase.toString(),
    freeBase: freeBase.toString(),
    liquidBase: liquidBase.toString(),
    planFactMonth: {
      inflowPlanBase: inflowPlanBase.toString(),
      inflowFactBase: inflowFactBase.toString(),
      outflowPlanBase: outflowPlanBase.toString(),
      outflowFactBase: outflowFactBase.toString(),
      hasInflowPlan: !inflowPlanBase.isZero(),
      hasOutflowPlan: !outflowPlanBase.isZero(),
    },
    upcomingObligations30d,
    topCategoriesDelta,
  };
});

// ─────────────────────────────────────────────────────────────
// Daily net cashflow for the last 30 days (sparkline source)
// ─────────────────────────────────────────────────────────────

export const getCashflow30dDailyNet = cache(async (
  userId: string,
  baseCcy: string,
): Promise<number[]> => {
  const now = new Date();
  const start = addDays(now, -29); // 30 days inclusive: start..now

  const [proj, rates] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
  ]);

  const txns = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: start, lte: now },
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
      transferId: null,
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

  // Build 30-slot array indexed 0..29 where index 0 = start day, 29 = today
  const buckets: Prisma.Decimal[] = Array.from({ length: 30 }, () => new Prisma.Decimal(0));

  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());

  for (const txn of txns) {
    const txDay = Date.UTC(txn.occurredAt.getUTCFullYear(), txn.occurredAt.getUTCMonth(), txn.occurredAt.getUTCDate());
    const idx = Math.round((txDay - startDay) / (24 * 60 * 60 * 1000));
    if (idx < 0 || idx > 29) continue;

    const override = proj.rewriteAmount(txn.id);
    let signed: Prisma.Decimal;
    if (override) {
      // Compensation main: netBase is already in baseCcy; sign -1 means net expense
      signed = override.sign === -1 ? override.netBase.negated() : override.netBase;
    } else {
      const actual = confirmedAmt(txn as Parameters<typeof confirmedAmt>[0]);
      const inBase = convertToBase(actual, txn.currencyCode, baseCcy, rates);
      if (!inBase) continue;
      signed = txn.kind === TransactionKind.INCOME ? inBase : inBase.negated();
    }
    buckets[idx] = buckets[idx].plus(signed);
  }

  return buckets.map((b) => Number(b.toFixed(0)));
});
