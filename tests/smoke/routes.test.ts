/**
 * tests/smoke/routes.test.ts
 *
 * Smoke tests: prove that data-layer loaders for the 6 key routes resolve
 * without throwing on both empty (reference-only) and populated datasets.
 *
 * Scope: breadth over depth. Every loader called by a route's page.tsx is
 * exercised; exact numeric assertions are left to integration tests.
 *
 * Routes covered:
 *   1. Home          — page.tsx + @summary/page.tsx
 *   2. Transactions  — transactions/page.tsx
 *   3. Analytics     — analytics/page.tsx
 *   4. Expenses      — expenses/page.tsx
 *   5. Wallet        — wallet/page.tsx
 *   6. Planning      — planning/page.tsx
 */

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import {
  makeAccount,
  makeTransaction,
  makeSubscription,
  makeLoan,
  makeFund,
  makePlannedEvent,
  makePersonalDebt,
  makeLongProject,
  makeWorkSource,
  makeTransfer,
} from "@/tests/fixtures/builders";
import { TransactionKind, TransactionStatus, AccountKind, FundKind } from "@prisma/client";

// ── Data loaders under test ──────────────────────────────────────────────────

// Home
import { getHomeDashboard } from "@/lib/data/dashboard";
import { getDismissedSignals, computeSignals } from "@/lib/data/signals";
import {
  getShrinkableCategories,
  getObligatoryDiscretionarySplit,
  getEconomyExitScenario,
  getBurnRate,
} from "@/lib/data/analytics-prescriptive";

// Transactions
import {
  getTransactionsGroupedByDay,
  getTransactionsPeriodSummary,
} from "@/lib/data/transactions";
import { getPersonalDebtsWithProgress } from "@/lib/data/debts";
import { getCompensationProjection } from "@/lib/data/_shared/compensation-projection";
import { getPeriodFlow } from "@/lib/data/_shared/period-aggregates";
import { getConnectedCredentials } from "@/lib/data/_queries/integrations";
import { getBudgetSettings } from "@/lib/data/settings";

// Analytics
import {
  resolveAnalyticsRange,
  getPeriodKpis,
  getCategoryPie,
  getPeriodCompare,
  getForecastMonth,
  getForecastYear,
  getWeather,
  getTrendPoints,
  getCompareSparklines,
} from "@/lib/data/analytics";
import { getRunwayByMode } from "@/lib/data/analytics-runway";
import { getAvailableNow } from "@/lib/data/_shared/period-aggregates";

// Expenses
import { getLoans } from "@/lib/data/loans";
import { getSubscriptionsGrouped } from "@/lib/data/subscriptions";
import { getLongProjects } from "@/lib/data/long-projects";
import { getCreditCardObligations } from "@/lib/data/credit-cards";

// Wallet
import {
  getInstitutionsWithAccounts,
  getCashStash,
  getArchivedAccounts,
  getWalletTotals,
  getLatestRatesMap,
  getFxRates,
} from "@/lib/data/wallet";
import { listAllCurrencies } from "@/lib/data/currencies";

// Planning
import { getFundsWithProgress } from "@/lib/data/funds";
import { getPlannedEvents } from "@/lib/data/planned-events";
import { getPrimaryWorkSource } from "@/lib/data/work-sources";

// ── Constants ────────────────────────────────────────────────────────────────

const USER = DEFAULT_USER_ID;
const BASE_CCY = "RUB";
const TZ = "Europe/Moscow";
// Pinned "now" so calcs don't depend on wall clock
const NOW = new Date("2026-06-21T12:00:00Z");

// 3-month analytics range (matches default period)
const RANGE_3M = resolveAnalyticsRange("3m", TZ, NOW);

// ── Shared world builder ─────────────────────────────────────────────────────

/**
 * Seeds a representative populated dataset used by most smoke tests.
 * Returns ids that tests may need to reference.
 */
async function seedPopulatedWorld() {
  // Two accounts: RUB card + USD card
  const rubAcct = await makeAccount(db, {
    name: "Main RUB",
    currencyCode: "RUB",
    balance: "150000",
    kind: AccountKind.CARD,
  });
  const usdAcct = await makeAccount(db, {
    name: "USD Card",
    currencyCode: "USD",
    balance: "500",
    kind: AccountKind.CARD,
  });

  // Resolve categories seeded by seedReferenceData
  const groceriesCat = await db.category.findFirst({
    where: { userId: USER, name: "Groceries", kind: "EXPENSE" },
    select: { id: true },
  });
  const salaryCat = await db.category.findFirst({
    where: { userId: USER, name: "Salary", kind: "INCOME" },
    select: { id: true },
  });

  // Transactions: income this month
  const thisMonth = new Date(NOW.getFullYear(), NOW.getMonth(), 5);
  const lastMonth = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 10);

  await makeTransaction(db, {
    accountId: rubAcct.id,
    kind: TransactionKind.INCOME,
    status: TransactionStatus.DONE,
    amount: "80000",
    currencyCode: "RUB",
    occurredAt: thisMonth,
    name: "Salary June",
    categoryId: salaryCat?.id,
  });

  // Expense this month
  await makeTransaction(db, {
    accountId: rubAcct.id,
    kind: TransactionKind.EXPENSE,
    status: TransactionStatus.DONE,
    amount: "15000",
    currencyCode: "RUB",
    occurredAt: thisMonth,
    name: "Groceries June",
    categoryId: groceriesCat?.id,
  });

  // Expense last month (for compare)
  await makeTransaction(db, {
    accountId: rubAcct.id,
    kind: TransactionKind.EXPENSE,
    status: TransactionStatus.DONE,
    amount: "12000",
    currencyCode: "RUB",
    occurredAt: lastMonth,
    name: "Groceries May",
    categoryId: groceriesCat?.id,
  });

  // Transfer between accounts
  const xfr = await makeTransfer(db, {
    fromAccountId: rubAcct.id,
    toAccountId: usdAcct.id,
    fromAmount: "10000",
    toAmount: "100",
    fromCcy: "RUB",
    toCcy: "USD",
    rate: "0.01",
    occurredAt: thisMonth,
  });

  // Transfer transactions
  await makeTransaction(db, {
    accountId: rubAcct.id,
    kind: TransactionKind.TRANSFER,
    status: TransactionStatus.DONE,
    amount: "10000",
    currencyCode: "RUB",
    occurredAt: thisMonth,
    name: "Transfer out",
    transferId: xfr.id,
  });

  // Subscription
  const sub = await makeSubscription(db, {
    name: "Netflix",
    price: "599",
    currencyCode: "RUB",
    billingIntervalMonths: 1,
    nextPaymentDate: new Date(NOW.getFullYear(), NOW.getMonth(), 25),
    isActive: true,
  });

  // Loan
  const loan = await makeLoan(db, {
    name: "Car Loan",
    principal: "500000",
    annualRatePct: "15",
    termMonths: 36,
    startDate: new Date("2024-01-01"),
    currencyCode: "RUB",
  });

  // Fund (savings goal)
  const fund = await makeFund(db, {
    kind: FundKind.VAULT,
    name: "Emergency Fund",
    goalAmount: "200000",
    currentAmount: "50000",
    currencyCode: "RUB",
    targetDate: new Date("2027-01-01"),
  });

  // Planned event (upcoming)
  await makePlannedEvent(db, {
    kind: "BIRTHDAY",
    name: "Mom's Birthday",
    eventDate: new Date(NOW.getFullYear(), NOW.getMonth(), 28),
    fundId: fund.id,
    expectedAmount: "5000",
    currencyCode: "RUB",
  });

  // Personal debt
  await makePersonalDebt(db, {
    direction: "LENT",
    counterparty: "Alice",
    principal: "10000",
    currencyCode: "RUB",
    openedAt: lastMonth,
  });

  // Long project
  await makeLongProject(db, {
    name: "Apartment Renovation",
    budget: "300000",
    currencyCode: "RUB",
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-09-01"),
  });

  // Work source (hourly)
  await makeWorkSource(db, {
    name: "Freelance Dev",
    kind: "FREELANCE",
    rateType: "HOURLY",
    rateAmount: "2000",
    currencyCode: "RUB",
    isActive: true,
  });

  return { rubAcct, usdAcct, sub, loan, fund };
}

// ── 1. HOME route ────────────────────────────────────────────────────────────

describe("smoke: Home route loaders", () => {
  it("[empty] getHomeDashboard resolves on empty data", async () => {
    const result = await getHomeDashboard(USER, BASE_CCY);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("safeUntilDays");
    expect(result).toHaveProperty("balances");
    expect(Array.isArray(result.balances)).toBe(true);
  });

  it("[empty] getDismissedSignals resolves on empty data", async () => {
    const result = await getDismissedSignals(USER);
    expect(result).toBeDefined();
    expect(result instanceof Set).toBe(true);
  });

  it("[empty] getShrinkableCategories resolves on empty data", async () => {
    const result = await getShrinkableCategories(USER, BASE_CCY, TZ, NOW);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getObligatoryDiscretionarySplit resolves on empty data", async () => {
    const range = {
      from: new Date(NOW.getFullYear(), NOW.getMonth(), 1),
      to: NOW,
    };
    const result = await getObligatoryDiscretionarySplit(USER, range, BASE_CCY, TZ);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("obligatoryBase");
    expect(result).toHaveProperty("discretionaryBase");
  });

  it("[empty] getEconomyExitScenario resolves on empty data", async () => {
    const result = await getEconomyExitScenario(USER, BASE_CCY, TZ, NOW);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("deficitBase");
  });

  it("[populated] getHomeDashboard resolves with data", async () => {
    await seedPopulatedWorld();
    const result = await getHomeDashboard(USER, BASE_CCY);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("safeUntilDays");
    expect(Array.isArray(result.upcomingObligations30d)).toBe(true);
    expect(Array.isArray(result.topCategoriesDelta)).toBe(true);
  });

  it("[populated] computeSignals does not throw with populated data", async () => {
    await seedPopulatedWorld();
    const range = {
      from: new Date(NOW.getFullYear(), NOW.getMonth(), 1),
      to: NOW,
    };
    const [dashboard, shrinkable, discretionary, economyExit] = await Promise.all([
      getHomeDashboard(USER, BASE_CCY),
      getShrinkableCategories(USER, BASE_CCY, TZ, NOW),
      getObligatoryDiscretionarySplit(USER, range, BASE_CCY, TZ),
      getEconomyExitScenario(USER, BASE_CCY, TZ, NOW),
    ]);
    const signals = computeSignals({ dashboard, shrinkable, discretionary, economyExit, baseCcy: BASE_CCY });
    expect(Array.isArray(signals)).toBe(true);
  });
});

// ── 2. TRANSACTIONS route ────────────────────────────────────────────────────

describe("smoke: Transactions route loaders", () => {
  const filters = {
    from: new Date(NOW.getTime() - 30 * 86400_000),
    to: NOW,
  };

  it("[empty] getTransactionsGroupedByDay resolves on empty data", async () => {
    const result = await getTransactionsGroupedByDay(USER, filters, TZ);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getTransactionsPeriodSummary resolves on empty data", async () => {
    const result = await getTransactionsPeriodSummary(USER, {
      from: filters.from,
      to: filters.to,
      baseCcy: BASE_CCY,
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("totalCount");
  });

  it("[empty] getPeriodFlow resolves on empty data", async () => {
    // @summary/transactions slot loader — exercise the empty-array flow path.
    const result = await getPeriodFlow(USER, { from: filters.from, to: filters.to }, BASE_CCY);
    expect(result).toBeDefined();
  });

  it("[empty] getPersonalDebtsWithProgress resolves on empty data", async () => {
    const result = await getPersonalDebtsWithProgress(USER, { status: "open" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getCompensationProjection resolves on empty data", async () => {
    const result = await getCompensationProjection(USER);
    expect(result).toBeDefined();
  });

  it("[empty] getConnectedCredentials resolves on empty data", async () => {
    const result = await getConnectedCredentials(USER);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getBudgetSettings resolves on empty data", async () => {
    // seedReferenceData creates budget settings — should exist
    const result = await getBudgetSettings(USER);
    expect(result).toBeDefined();
  });

  it("[populated] all Transactions loaders resolve with data", async () => {
    await seedPopulatedWorld();

    const [days, summary, debts, proj] = await Promise.all([
      getTransactionsGroupedByDay(USER, filters, TZ),
      getTransactionsPeriodSummary(USER, { from: filters.from, to: filters.to, baseCcy: BASE_CCY }),
      getPersonalDebtsWithProgress(USER, { status: "open" }),
      getCompensationProjection(USER),
    ]);

    expect(Array.isArray(days)).toBe(true);
    expect(summary).toHaveProperty("totalCount");
    expect(Array.isArray(debts)).toBe(true);
    expect(debts.length).toBeGreaterThanOrEqual(1); // seeded 1 debt
    expect(proj).toBeDefined();
  });
});

// ── 3. ANALYTICS route ───────────────────────────────────────────────────────

describe("smoke: Analytics route loaders", () => {
  it("[empty] getPeriodKpis resolves on empty data", async () => {
    const result = await getPeriodKpis(USER, RANGE_3M, BASE_CCY);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("inflowBase");
    expect(result).toHaveProperty("outflowBase");
  });

  it("[empty] getCategoryPie resolves on empty data", async () => {
    const result = await getCategoryPie(USER, RANGE_3M, BASE_CCY);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getPeriodCompare resolves on empty data", async () => {
    const result = await getPeriodCompare(USER, RANGE_3M, BASE_CCY, null);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getForecastMonth resolves on empty data", async () => {
    const result = await getForecastMonth(USER, BASE_CCY);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("inflowExpectedBase");
    expect(result).toHaveProperty("outflowExpectedBase");
  });

  it("[empty] getForecastYear resolves on empty data", async () => {
    const result = await getForecastYear(USER, BASE_CCY, TZ);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("netProjectedBase");
  });

  it("[empty] getWeather resolves on empty data", async () => {
    const result = await getWeather(USER, BASE_CCY, TZ, RANGE_3M);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("kind");
  });

  it("[empty] getTrendPoints resolves on empty data", async () => {
    const result = await getTrendPoints(USER, RANGE_3M, BASE_CCY, "monthly", TZ);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getCompareSparklines resolves on empty data", async () => {
    const result = await getCompareSparklines(USER, BASE_CCY, TZ, 6, NOW.getTime());
    expect(result instanceof Map).toBe(true);
  });

  it("[empty] getRunwayByMode resolves on empty data", async () => {
    const result = await getRunwayByMode(USER, BASE_CCY, TZ);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("byMode");
    expect(result.byMode).toHaveProperty("ECONOMY");
    expect(result.byMode).toHaveProperty("NORMAL");
    expect(result.byMode).toHaveProperty("FREE");
  });

  it("[empty] getAvailableNow resolves on empty data", async () => {
    const result = await getAvailableNow(USER, BASE_CCY, NOW);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("liquidBase");
    expect(result).toHaveProperty("reservedBase");
    expect(result).toHaveProperty("freeBase");
  });

  it("[empty] getBurnRate resolves on empty data", async () => {
    const result = await getBurnRate(USER, BASE_CCY, TZ, NOW);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("perDay30dBase");
    expect(result).toHaveProperty("daysToZero");
  });

  it("[empty] getShrinkableCategories resolves on empty data", async () => {
    const result = await getShrinkableCategories(USER, BASE_CCY, TZ, NOW);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[populated] all Analytics loaders resolve with data", async () => {
    await seedPopulatedWorld();

    const [kpis, pie, forecast, weather, runway, burnRate] = await Promise.all([
      getPeriodKpis(USER, RANGE_3M, BASE_CCY),
      getCategoryPie(USER, RANGE_3M, BASE_CCY),
      getForecastMonth(USER, BASE_CCY),
      getWeather(USER, BASE_CCY, TZ, RANGE_3M),
      getRunwayByMode(USER, BASE_CCY, TZ),
      getBurnRate(USER, BASE_CCY, TZ, NOW),
    ]);

    expect(kpis).toHaveProperty("inflowBase");
    expect(Array.isArray(pie)).toBe(true);
    expect(forecast).toHaveProperty("inflowExpectedBase");
    expect(weather).toHaveProperty("kind");
    expect(runway).toHaveProperty("byMode");
    expect(burnRate).toHaveProperty("perDay30dBase");
  });
});

// ── 4. EXPENSES route ────────────────────────────────────────────────────────

describe("smoke: Expenses route loaders", () => {
  it("[empty] getLoans resolves on empty data", async () => {
    const result = await getLoans(USER);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getCreditCardObligations resolves on empty data", async () => {
    const result = await getCreditCardObligations(USER);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getSubscriptionsGrouped resolves on empty data", async () => {
    const result = await getSubscriptionsGrouped(USER);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("totals");
    expect(result).toHaveProperty("personal");
    expect(result).toHaveProperty("split");
    expect(result).toHaveProperty("paidForOthers");
  });

  it("[empty] getLongProjects resolves on empty data", async () => {
    const result = await getLongProjects(USER);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[populated] all Expenses loaders resolve with data", async () => {
    await seedPopulatedWorld();

    const [loans, cards, subs, projects, rates] = await Promise.all([
      getLoans(USER),
      getCreditCardObligations(USER),
      getSubscriptionsGrouped(USER),
      getLongProjects(USER),
      getLatestRatesMap(),
    ]);

    expect(Array.isArray(loans)).toBe(true);
    expect(loans.length).toBeGreaterThanOrEqual(1); // seeded 1 loan
    expect(Array.isArray(cards)).toBe(true);
    expect(subs).toHaveProperty("totals");
    expect(subs.personal.length).toBeGreaterThanOrEqual(1); // seeded 1 subscription
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThanOrEqual(1); // seeded 1 project
    expect(rates instanceof Map).toBe(true);
  });
});

// ── 5. WALLET route ──────────────────────────────────────────────────────────

describe("smoke: Wallet route loaders", () => {
  it("[empty] getInstitutionsWithAccounts resolves on empty data", async () => {
    const result = await getInstitutionsWithAccounts(USER);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getCashStash resolves on empty data", async () => {
    const result = await getCashStash(USER);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getArchivedAccounts resolves on empty data", async () => {
    const result = await getArchivedAccounts(USER);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getWalletTotals resolves on empty data", async () => {
    const result = await getWalletTotals(USER, BASE_CCY);
    expect(result).toBeDefined();
  });

  it("[empty] getLatestRatesMap resolves on empty data", async () => {
    const result = await getLatestRatesMap();
    expect(result instanceof Map).toBe(true);
  });

  it("[empty] getFxRates resolves on empty data", async () => {
    const result = await getFxRates(["USD/RUB", "EUR/RUB"]);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] listAllCurrencies resolves", async () => {
    const result = await listAllCurrencies();
    expect(Array.isArray(result)).toBe(true);
    // seedReferenceData inserts currencies
    expect(result.length).toBeGreaterThan(0);
  });

  it("[populated] all Wallet loaders resolve with accounts", async () => {
    const { rubAcct } = await seedPopulatedWorld();

    const [institutions, cash, archived, totals, rates] = await Promise.all([
      getInstitutionsWithAccounts(USER),
      getCashStash(USER),
      getArchivedAccounts(USER),
      getWalletTotals(USER, BASE_CCY),
      getLatestRatesMap(),
    ]);

    // CARD accounts go to institutions (they have no institution in builders → fall to cash?)
    // Either way: no throw + results defined
    expect(Array.isArray(institutions)).toBe(true);
    expect(Array.isArray(cash)).toBe(true);
    expect(Array.isArray(archived)).toBe(true);
    expect(totals).toBeDefined();
    expect(rates instanceof Map).toBe(true);
    // Rates map should have seeded pairs
    expect(rates.size).toBeGreaterThan(0);
    // rubAcct exists in DB (loaders resolve without throw — primary smoke goal)
    void rubAcct;
  });
});

// ── 6. PLANNING route ────────────────────────────────────────────────────────

describe("smoke: Planning route loaders", () => {
  const window90End = new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000);
  const window14End = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);

  it("[empty] getFundsWithProgress resolves on empty data", async () => {
    const result = await getFundsWithProgress(USER);
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getPlannedEvents (90d window) resolves on empty data", async () => {
    const result = await getPlannedEvents(USER, { from: NOW, to: window90End });
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getPlannedEvents (14d window) resolves on empty data", async () => {
    const result = await getPlannedEvents(USER, { from: NOW, to: window14End });
    expect(Array.isArray(result)).toBe(true);
  });

  it("[empty] getPrimaryWorkSource resolves on empty data", async () => {
    const result = await getPrimaryWorkSource(USER);
    // null is valid: no work source seeded
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("[populated] all Planning loaders resolve with data", async () => {
    await seedPopulatedWorld();

    const [funds, events90, events14, workSource] = await Promise.all([
      getFundsWithProgress(USER),
      getPlannedEvents(USER, { from: NOW, to: window90End }),
      getPlannedEvents(USER, { from: NOW, to: window14End }),
      getPrimaryWorkSource(USER),
    ]);

    expect(Array.isArray(funds)).toBe(true);
    expect(funds.length).toBeGreaterThanOrEqual(1); // seeded 1 fund

    // Each fund must expose progress fields used by the page
    for (const f of funds) {
      expect(f).toHaveProperty("currentAmount");
      expect(f).toHaveProperty("goalAmount");
      expect(f).toHaveProperty("progressPct");
      expect(f).toHaveProperty("remainingAmount");
    }

    expect(Array.isArray(events90)).toBe(true);
    // seeded 1 event on NOW+7d — should be in 90d window
    expect(events90.length).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(events14)).toBe(true);

    // work source should be found
    expect(workSource).not.toBeNull();
    if (workSource) {
      expect(workSource).toHaveProperty("rateAmount");
    }
  });
});
