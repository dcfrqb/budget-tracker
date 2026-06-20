import { cache } from "react";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getLatestRatesMap,
  convertToBase,
  getInstitutionsWithAccounts,
  getCashStash,
  resolveCreditState,
} from "@/lib/data/wallet";
import { getCompensationProjection } from "@/lib/data/_shared/compensation-projection";
import { loadPeriodTxns, loadPeriodFlowCount } from "@/lib/data/_shared/period-txn-loader";
import { getLoans } from "@/lib/data/loans";
import { getSubscriptions } from "@/lib/data/subscriptions";
import { getFundsWithProgress } from "@/lib/data/funds";
import { getPlannedEvents } from "@/lib/data/planned-events";
import { computeAmortization } from "@/lib/amortization";
import { computeReserved, computeFreeAmount } from "@/lib/forecast";

export type DateRange = { from: Date; to: Date };

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

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
// getPeriodFlow
//
// Aggregates inflow (INCOME) and outflow (EXPENSE) for a range.
// Hard-filters transferId IS NULL and kind != TRANSFER so transfers
// can never leak into income/expense totals.
//
// txCount = rendered row count: paired transfers (non-null transferId)
// count as 1 per pair (from-leg only); unpaired rows count as 1 each.
// ─────────────────────────────────────────────────────────────

export type PeriodFlow = {
  inflowBase: Prisma.Decimal;
  outflowBase: Prisma.Decimal;
  netBase: Prisma.Decimal;
  txCount: number;
};

export const getPeriodFlow = cache(async (
  userId: string,
  range: DateRange,
  baseCcy: string,
): Promise<PeriodFlow> => {
  const fromISO = range.from.toISOString();
  const toISO = range.to.toISOString();

  const [proj, rates, sumRows, flowCount] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
    loadPeriodTxns(userId, fromISO, toISO, "flow"),
    loadPeriodFlowCount(userId, fromISO, toISO),
  ]);

  const zero = new Prisma.Decimal(0);
  let inflow = zero;
  let outflow = zero;

  for (const t of sumRows) {
    const override = proj.rewriteAmount(t.id);
    let inBase: Prisma.Decimal | undefined;
    if (override) {
      inBase = override.netBase;
      // override.sign: +1 = income side wins, -1 = expense side wins
      if (override.sign === 1) inflow = inflow.plus(inBase);
      else outflow = outflow.plus(inBase);
    } else {
      const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
      const converted = convertToBase(actual, t.currencyCode, baseCcy, rates);
      if (!converted) continue;
      inBase = converted;
      if (t.kind === TransactionKind.INCOME) inflow = inflow.plus(inBase);
      else outflow = outflow.plus(inBase);
    }
  }

  const txCount = flowCount.txCount;

  return {
    inflowBase: inflow,
    outflowBase: outflow,
    netBase: inflow.minus(outflow),
    txCount,
  };
});

// ─────────────────────────────────────────────────────────────
// getCategoryBreakdown
//
// Returns a map of categoryId → Decimal in baseCcy.
// Hard-filters transferId IS NULL and kind matching the requested
// kind ('INCOME' | 'EXPENSE') so transfers never appear.
// Only DONE+PARTIAL transactions with a non-null categoryId are counted.
// ─────────────────────────────────────────────────────────────

export const getCategoryBreakdown = cache(async (
  userId: string,
  range: DateRange,
  baseCcy: string,
  kind: "INCOME" | "EXPENSE",
): Promise<Map<string, Prisma.Decimal>> => {
  const txKind = kind === "INCOME" ? TransactionKind.INCOME : TransactionKind.EXPENSE;

  const fromISO = range.from.toISOString();
  const toISO = range.to.toISOString();

  const [proj, rates, allRows] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
    loadPeriodTxns(userId, fromISO, toISO, "flow"),
  ]);

  const rows = allRows.filter((t) => t.kind === txKind && t.categoryId !== null);

  const byCat = new Map<string, Prisma.Decimal>();
  for (const t of rows) {
    if (!t.categoryId) continue;
    const override = proj.rewriteAmount(t.id);
    let inBase: Prisma.Decimal | undefined;
    let catId = t.categoryId;
    if (override) {
      inBase = override.netBase;
      // For category breakdown, use categoryIdForAggregation from the group
      const groupInfo = proj.groupByMainTxnId.get(t.id);
      if (groupInfo?.categoryIdForAggregation) {
        catId = groupInfo.categoryIdForAggregation;
      }
    } else {
      const actual = confirmedAmt(t as Parameters<typeof confirmedAmt>[0]);
      const converted = convertToBase(actual, t.currencyCode, baseCcy, rates);
      if (!converted) continue;
      inBase = converted;
    }
    byCat.set(catId, (byCat.get(catId) ?? new Prisma.Decimal(0)).plus(inBase));
  }
  return byCat;
});

// ─────────────────────────────────────────────────────────────
// getAvailableNow
//
// Single source of truth for balance/reserved/free/liquid.
// "now" is passed in from the caller (never computed here) so that
// react.cache() deduplication works correctly within a request.
// ─────────────────────────────────────────────────────────────

export type AvailableNow = {
  totalBase: Prisma.Decimal;
  reservedBase: Prisma.Decimal;
  freeBase: Prisma.Decimal;
  liquidBase: Prisma.Decimal;
  perCurrencyRows: Array<{ ccy: string; balance: Prisma.Decimal }>;
};

export const getAvailableNow = cache(async (
  userId: string,
  baseCcy: string,
  now: Date,
): Promise<AvailableNow> => {
  const window30End = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [institutions, cash, rates, loans, subs, funds, plannedEvents30d, creditAccounts] =
    await Promise.all([
      getInstitutionsWithAccounts(userId),
      getCashStash(userId),
      getLatestRatesMap(),
      getLoans(userId),
      getSubscriptions(userId),
      getFundsWithProgress(userId),
      getPlannedEvents(userId, { from: now, to: window30End }),
      db.account.findMany({
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
          currencyCode: true,
          debtBalance: true,
          minPaymentFixed: true,
          minPaymentPercent: true,
          paymentDueDay: true,
          statementDay: true,
        },
      }),
    ]);

  const balanceMap = new Map<string, Prisma.Decimal>();
  let liquidBase = new Prisma.Decimal(0);

  const addBalance = (ccy: string, amount: Prisma.Decimal) => {
    balanceMap.set(ccy, (balanceMap.get(ccy) ?? new Prisma.Decimal(0)).plus(amount));
  };
  const addLiquid = (ccy: string, amount: Prisma.Decimal) => {
    const inBase = convertToBase(amount, ccy, baseCcy, rates);
    if (inBase && inBase.greaterThan(0)) liquidBase = liquidBase.plus(inBase);
  };

  for (const inst of institutions) {
    for (const acc of inst.accounts) {
      if (acc.kind === "LOAN") continue;
      if (!acc.includeInAnalytics) continue;
      if (acc.kind === "CREDIT") {
        const state = resolveCreditState(acc);
        addBalance(acc.currencyCode, state.debt.negated());
        addLiquid(acc.currencyCode, state.available);
      } else {
        const bal = new Prisma.Decimal(acc.balance);
        addBalance(acc.currencyCode, bal);
        addLiquid(acc.currencyCode, bal);
      }
    }
  }
  for (const acc of cash) {
    if (!acc.includeInAnalytics) continue;
    const bal = new Prisma.Decimal(acc.balance);
    addBalance(acc.currencyCode, bal);
    addLiquid(acc.currencyCode, bal);
  }

  let totalBase = new Prisma.Decimal(0);
  const perCurrencyRows: AvailableNow["perCurrencyRows"] = [];
  for (const [ccy, amount] of balanceMap.entries()) {
    const inBase = convertToBase(amount, ccy, baseCcy, rates);
    const amountBase = inBase ?? new Prisma.Decimal(0);
    totalBase = totalBase.plus(amountBase);
    perCurrencyRows.push({ ccy, balance: amount });
  }

  // Reserved: subscriptions due in 30d
  let subscriptions30dBase = new Prisma.Decimal(0);
  for (const sub of subs) {
    if (sub.nextPaymentDate <= window30End) {
      const inBase = convertToBase(sub.price, sub.currencyCode, baseCcy, rates);
      if (inBase) subscriptions30dBase = subscriptions30dBase.plus(inBase);
    }
  }

  // Reserved: loan payments due in 30d
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

  // Reserved: planned events with expectedAmount in 30d
  let plannedOutflows30dBase = new Prisma.Decimal(0);
  for (const ev of plannedEvents30d) {
    if (ev.expectedAmount && ev.currencyCode) {
      const inBase = convertToBase(ev.expectedAmount, ev.currencyCode, baseCcy, rates);
      if (inBase) plannedOutflows30dBase = plannedOutflows30dBase.plus(inBase);
    }
  }

  // Reserved: funds monthly contributions
  let fundsContribTargets30dBase = new Prisma.Decimal(0);
  for (const fund of funds) {
    if (fund.monthlyContribution) {
      const inBase = convertToBase(fund.monthlyContribution, fund.currencyCode, baseCcy, rates);
      if (inBase) fundsContribTargets30dBase = fundsContribTargets30dBase.plus(inBase);
    }
  }

  // Reserved: credit card minimum payments due in 30d
  let creditCardPayments30dBase = new Prisma.Decimal(0);
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
      nextDueDate = candidate >= now
        ? candidate
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day));
    } else if (card.statementDay) {
      const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), card.statementDay + 20));
      nextDueDate = candidate >= now
        ? candidate
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, card.statementDay + 20));
    }
    if (!nextDueDate || nextDueDate > window30End) continue;

    const inBase = convertToBase(effectiveAmount, card.currencyCode, baseCcy, rates);
    if (inBase) creditCardPayments30dBase = creditCardPayments30dBase.plus(inBase);
  }

  const reservedBase = computeReserved({
    subscriptions30dBase,
    loanPayments30dBase,
    plannedOutflows30dBase,
    fundsContribTargets30dBase,
    creditCardPayments30dBase,
  });
  const freeBase = computeFreeAmount(totalBase, reservedBase);

  return {
    totalBase,
    reservedBase,
    freeBase,
    liquidBase,
    perCurrencyRows,
  };
});
