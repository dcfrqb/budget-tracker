import { cache } from "react";
import { Prisma, TransactionKind, TransactionStatus, BudgetMode } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getInstitutionsWithAccounts,
  getCashStash,
  getLatestRatesMap,
  convertToBase,
} from "@/lib/data/wallet";
import { getLoans } from "@/lib/data/loans";
import { getSubscriptions } from "@/lib/data/subscriptions";
import { getFundsWithProgress } from "@/lib/data/funds";
import { getPlannedEvents } from "@/lib/data/planned-events";
import { computeAmortization } from "@/lib/amortization";
import {
  computeReserved,
  computeSafeUntil,
  computeFreeAmount,
} from "@/lib/forecast";
import { resolveCreditState } from "@/lib/data/wallet";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type DashboardStatus = "stable" | "warning" | "crisis";

export type UpcomingObligation = {
  id: string;
  kind: "subscription" | "loan" | "planned" | "debt";
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
    institutions,
    cash,
    rates,
    budgetSettings,
    loans,
    subs,
    funds,
    plannedEvents30d,
    // Транзакции для plan/fact (текущий месяц)
    monthTxns,
    // Транзакции для avg daily spend (за период)
    last30Txns,
    // Топ категорий: текущий и предыдущий месяц
    prevMonthStart,
    prevMonthEnd,
    categories,
  ] = await Promise.all([
    getInstitutionsWithAccounts(userId),
    getCashStash(userId),
    getLatestRatesMap(),
    db.budgetSettings.findUnique({ where: { userId } }),
    getLoans(userId),
    getSubscriptions(userId),
    getFundsWithProgress(userId),
    getPlannedEvents(userId, { from: now, to: window30End }),
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: periodStart, lte: periodEnd },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
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
        occurredAt: { gte: periodStart, lte: periodEnd },
        kind: TransactionKind.EXPENSE,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      },
      select: {
        status: true,
        amount: true,
        currencyCode: true,
        facts: { select: { amount: true } },
      },
    }),
    // prevMonthStart / prevMonthEnd — Date objects
    Promise.resolve(startOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))),
    Promise.resolve(endOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))),
    db.category.findMany({
      where: { userId, kind: "EXPENSE", archivedAt: null },
      select: { id: true, name: true, icon: true },
    }),
  ]);

  // ── Balances ──────────────────────────────────────────────
  const balanceMap = new Map<string, Prisma.Decimal>();
  const addBalance = (ccy: string, amount: Prisma.Decimal) => {
    balanceMap.set(ccy, (balanceMap.get(ccy) ?? new Prisma.Decimal(0)).plus(amount));
  };

  for (const inst of institutions) {
    for (const acc of inst.accounts) {
      // LOAN accounts represent liabilities — exclude from balance totals.
      if (acc.kind === "LOAN") continue;
      // Accounts excluded from analytics don't count towards safe-until / available
      if (!acc.includeInAnalytics) continue;
      // CREDIT accounts: net contribution = available - debt (per resolveCreditState).
      // For T-Bank synced accounts, `balance` is "available to spend" and `debtBalance`
      // is the actual liability — use the unified helper to avoid drift with
      // getWalletTotals / getBalancesByCurrency / toAccountView.
      if (acc.kind === "CREDIT") {
        const state = resolveCreditState(acc);
        addBalance(acc.currencyCode, state.available.minus(state.debt));
      } else {
        addBalance(acc.currencyCode, new Prisma.Decimal(acc.balance));
      }
    }
  }
  for (const acc of cash) {
    // Cash accounts excluded from analytics (default for CASH per D8 spec)
    if (!acc.includeInAnalytics) continue;
    addBalance(acc.currencyCode, new Prisma.Decimal(acc.balance));
  }

  let totalBalanceBase = new Prisma.Decimal(0);
  const balances: HomeDashboard["balances"] = [];
  for (const [ccy, amount] of balanceMap.entries()) {
    const inBase = convertToBase(amount, ccy, baseCcy, rates);
    const amountBase = inBase ?? new Prisma.Decimal(0);
    totalBalanceBase = totalBalanceBase.plus(amountBase);
    balances.push({
      currencyCode: ccy,
      amount: amount.toString(),
      amountBase: amountBase.toString(),
    });
  }

  // ── avgDailySpend (последние 30д) ─────────────────────────
  let totalExpenseLast30 = new Prisma.Decimal(0);
  for (const t of last30Txns) {
    const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (inBase) totalExpenseLast30 = totalExpenseLast30.plus(inBase);
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

  // ── Reserved ─────────────────────────────────────────────
  // Subscriptions: сумма тех, у кого nextPaymentDate <= now+30d
  let subscriptions30dBase = new Prisma.Decimal(0);
  for (const sub of subs) {
    if (sub.nextPaymentDate <= window30End) {
      const inBase = convertToBase(sub.price, sub.currencyCode, baseCcy, rates);
      if (inBase) subscriptions30dBase = subscriptions30dBase.plus(inBase);
    }
  }

  // Loan payments: проходим по амортизации, берём первый незакрытый платёж в окне
  let loanPayments30dBase = new Prisma.Decimal(0);
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
      const inBase = convertToBase(nextRow.payment, loan.currencyCode, baseCcy, rates);
      if (inBase) loanPayments30dBase = loanPayments30dBase.plus(inBase);
    }
  }

  // PlannedEvents: события с expectedAmount в окне
  let plannedOutflows30dBase = new Prisma.Decimal(0);
  for (const ev of plannedEvents30d) {
    if (ev.expectedAmount && ev.currencyCode) {
      const inBase = convertToBase(ev.expectedAmount, ev.currencyCode, baseCcy, rates);
      if (inBase) plannedOutflows30dBase = plannedOutflows30dBase.plus(inBase);
    }
  }

  // Funds monthly contributions
  let fundsContribTargets30dBase = new Prisma.Decimal(0);
  for (const fund of funds) {
    if (fund.monthlyContribution) {
      const inBase = convertToBase(fund.monthlyContribution, fund.currencyCode, baseCcy, rates);
      if (inBase) fundsContribTargets30dBase = fundsContribTargets30dBase.plus(inBase);
    }
  }

  const reservedBase = computeReserved({
    subscriptions30dBase,
    loanPayments30dBase,
    plannedOutflows30dBase,
    fundsContribTargets30dBase,
  });

  const freeBase = computeFreeAmount(totalBalanceBase, reservedBase);

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

  for (const t of monthTxns) {
    const raw = new Prisma.Decimal(t.amount);
    const inBase = convertToBase(raw, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;

    const confirmed = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
    const confirmedBase = convertToBase(confirmed, t.currencyCode, baseCcy, rates) ?? new Prisma.Decimal(0);

    if (t.kind === TransactionKind.INCOME) {
      inflowPlanBase = inflowPlanBase.plus(inBase);
      if (t.status === TransactionStatus.DONE || t.status === TransactionStatus.PARTIAL) {
        inflowFactBase = inflowFactBase.plus(confirmedBase);
      }
    } else if (t.kind === TransactionKind.EXPENSE) {
      outflowPlanBase = outflowPlanBase.plus(inBase);
      if (t.status === TransactionStatus.DONE || t.status === TransactionStatus.PARTIAL) {
        outflowFactBase = outflowFactBase.plus(confirmedBase);
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

  obligations.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const upcomingObligations30d = obligations.slice(0, 20);

  // ── Top categories delta ──────────────────────────────────
  // Текущий месяц — EXPENSE DONE+PARTIAL
  const currentMonthCatTxns = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: TransactionKind.EXPENSE,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      occurredAt: { gte: monthStart, lte: monthEnd },
      categoryId: { not: null },
    },
    select: {
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
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      occurredAt: { gte: prevMonthStart, lte: prevMonthEnd },
      categoryId: { not: null },
    },
    select: {
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
    const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;
    currentByCat.set(t.categoryId, (currentByCat.get(t.categoryId) ?? new Prisma.Decimal(0)).plus(inBase));
  }

  const prevByCat = new Map<string, Prisma.Decimal>();
  for (const t of prevMonthCatTxns) {
    if (!t.categoryId) continue;
    const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) continue;
    prevByCat.set(t.categoryId, (prevByCat.get(t.categoryId) ?? new Prisma.Decimal(0)).plus(inBase));
  }

  // Top-3 по currentMonthBase
  const sortedCats = [...currentByCat.entries()]
    .sort((a, b) => b[1].comparedTo(a[1]))
    .slice(0, 3);

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

  const [txns, rates] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: start, lte: now },
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
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

  // Build 30-slot array indexed 0..29 where index 0 = start day, 29 = today
  const buckets: Prisma.Decimal[] = Array.from({ length: 30 }, () => new Prisma.Decimal(0));

  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());

  for (const txn of txns) {
    const actual = confirmedAmt(txn as Parameters<typeof confirmedAmt>[0]);
    const inBase = convertToBase(actual, txn.currencyCode, baseCcy, rates);
    if (!inBase) continue;

    const txDay = Date.UTC(txn.occurredAt.getUTCFullYear(), txn.occurredAt.getUTCMonth(), txn.occurredAt.getUTCDate());
    const idx = Math.round((txDay - startDay) / (24 * 60 * 60 * 1000));
    if (idx < 0 || idx > 29) continue;

    const signed = txn.kind === TransactionKind.INCOME ? inBase : inBase.negated();
    buckets[idx] = buckets[idx].plus(signed);
  }

  return buckets.map((b) => Number(b.toFixed(0)));
});
