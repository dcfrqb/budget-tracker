import { cache } from "react";
import { Prisma, BudgetMode } from "@prisma/client";
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
import { computeReserved, computeFreeAmount } from "@/lib/forecast";

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

/** Format a Date as YYYY-MM-DD in UTC */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────
// availableNow calculation
// Mirrors the logic from getHomeDashboard in lib/data/dashboard.ts.
// TODO: dedupe with getHomeDashboard once shared helper is extracted.
// ─────────────────────────────────────────────────────────────

async function getAvailableNowBase(
  userId: string,
  baseCcy: string,
): Promise<Prisma.Decimal> {
  const now = new Date();
  const window30End = addDays(now, 30);

  const [institutions, cash, rates, loans, subs, funds, plannedEvents30d] =
    await Promise.all([
      getInstitutionsWithAccounts(userId),
      getCashStash(userId),
      getLatestRatesMap(),
      getLoans(userId),
      getSubscriptions(userId),
      getFundsWithProgress(userId),
      getPlannedEvents(userId, { from: now, to: window30End }),
    ]);

  // ── Total balance ─────────────────────────────────────────
  const balanceMap = new Map<string, Prisma.Decimal>();
  const addBalance = (ccy: string, amount: Prisma.Decimal) => {
    balanceMap.set(ccy, (balanceMap.get(ccy) ?? new Prisma.Decimal(0)).plus(amount));
  };

  for (const inst of institutions) {
    for (const acc of inst.accounts) {
      if (acc.kind === "LOAN") continue;
      if (!acc.includeInAnalytics) continue;
      if (acc.kind === "CREDIT") {
        addBalance(acc.currencyCode, new Prisma.Decimal(acc.balance).negated());
      } else {
        addBalance(acc.currencyCode, new Prisma.Decimal(acc.balance));
      }
    }
  }
  for (const acc of cash) {
    if (!acc.includeInAnalytics) continue;
    addBalance(acc.currencyCode, new Prisma.Decimal(acc.balance));
  }

  let totalBalanceBase = new Prisma.Decimal(0);
  for (const [ccy, amount] of balanceMap.entries()) {
    const inBase = convertToBase(amount, ccy, baseCcy, rates);
    totalBalanceBase = totalBalanceBase.plus(inBase ?? new Prisma.Decimal(0));
  }

  // ── Reserved ─────────────────────────────────────────────
  let subscriptions30dBase = new Prisma.Decimal(0);
  for (const sub of subs) {
    if (sub.nextPaymentDate <= window30End) {
      const inBase = convertToBase(sub.price, sub.currencyCode, baseCcy, rates);
      if (inBase) subscriptions30dBase = subscriptions30dBase.plus(inBase);
    }
  }

  let loanPayments30dBase = new Prisma.Decimal(0);
  for (const loan of loans) {
    const paidCount = loan.payments.length;
    const schedule = computeAmortization({
      principal: new Prisma.Decimal(loan.principal),
      annualRatePct: new Prisma.Decimal(loan.annualRatePct),
      termMonths: loan.termMonths,
      startDate: loan.startDate,
    });
    const nextRow = schedule.find(
      (r) => r.n > paidCount && r.date >= now && r.date <= window30End,
    );
    if (nextRow) {
      const inBase = convertToBase(nextRow.payment, loan.currencyCode, baseCcy, rates);
      if (inBase) loanPayments30dBase = loanPayments30dBase.plus(inBase);
    }
  }

  let plannedOutflows30dBase = new Prisma.Decimal(0);
  for (const ev of plannedEvents30d) {
    if (ev.expectedAmount && ev.currencyCode) {
      const inBase = convertToBase(ev.expectedAmount, ev.currencyCode, baseCcy, rates);
      if (inBase) plannedOutflows30dBase = plannedOutflows30dBase.plus(inBase);
    }
  }

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

  return computeFreeAmount(totalBalanceBase, reservedBase);
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

  const untilDate = toISODate(addDays(asOf, days));

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
    ),
    [BudgetMode.NORMAL]: buildRunwayForMode(
      BudgetMode.NORMAL,
      categories,
      availableNowBase,
      asOf,
    ),
    [BudgetMode.FREE]: buildRunwayForMode(
      BudgetMode.FREE,
      categories,
      availableNowBase,
      asOf,
    ),
  };

  return {
    asOf: toISODate(asOf),
    baseCurrencyCode: baseCcy,
    byMode,
  };
});
