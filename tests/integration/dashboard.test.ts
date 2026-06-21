/**
 * integration/dashboard.test.ts
 *
 * Tests for getHomeDashboard (lib/data/dashboard.ts).
 *
 * NOTE: getHomeDashboard uses `new Date()` internally for `now`, so we cannot
 * pin the exact timestamp. Tests are designed around the CURRENT wall-clock:
 * - All "in-range" transactions use recent dates (within last 30 days).
 * - All "out-of-range" dates use far-past dates (> 60 days ago).
 * This approach is robust to any wall-clock drift in CI.
 *
 * Seeded categories:
 *   - "Groceries" (EXPENSE, essential=true, limitNormal=30000)
 *   - "Dining Out" (EXPENSE, essential=false, limitNormal=15000)
 *   - "Salary" (INCOME)
 * Seeded rates: USD→RUB=100, EUR→RUB=110
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { makeAccount, makeTransaction, makeSubscription } from "@/tests/fixtures/builders";
import { AccountKind } from "@prisma/client";
import { getHomeDashboard } from "@/lib/data/dashboard";

// Helper: a date N days ago relative to now (wall-clock safe)
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// Helper: a date N days from now
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

let accountId: string;
let salaryCatId: string;
let groceriesCatId: string;
let diningCatId: string;

beforeEach(async () => {
  // Use CASH kind so getAvailableNow picks it up via getCashStash (no institution needed)
  const account = await makeAccount(db, {
    balance: "100000",
    currencyCode: "RUB",
    kind: AccountKind.CASH,
  });
  accountId = account.id;

  const salaryCat = await db.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name: "Salary", kind: "INCOME" },
    select: { id: true },
  });
  const groceriesCat = await db.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name: "Groceries", kind: "EXPENSE" },
    select: { id: true },
  });
  const diningCat = await db.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name: "Dining Out", kind: "EXPENSE" },
    select: { id: true },
  });

  if (!salaryCat || !groceriesCat || !diningCat) {
    throw new Error("Required seeded categories not found");
  }

  salaryCatId = salaryCat.id;
  groceriesCatId = groceriesCat.id;
  diningCatId = diningCat.id;
});

// ─────────────────────────────────────────────────────────────
// Basic structure
// ─────────────────────────────────────────────────────────────

describe("getHomeDashboard — basic structure", () => {
  it("returns a HomeDashboard with the expected shape", async () => {
    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    expect(dashboard).toHaveProperty("status");
    expect(dashboard).toHaveProperty("budgetMode");
    expect(dashboard).toHaveProperty("balances");
    expect(dashboard).toHaveProperty("totalBalanceBase");
    expect(dashboard).toHaveProperty("safeUntilDays");
    expect(dashboard).toHaveProperty("reservedBase");
    expect(dashboard).toHaveProperty("freeBase");
    expect(dashboard).toHaveProperty("liquidBase");
    expect(dashboard).toHaveProperty("planFactMonth");
    expect(dashboard).toHaveProperty("upcomingObligations30d");
    expect(dashboard).toHaveProperty("topCategoriesDelta");
    expect(dashboard.budgetMode).toBe("NORMAL"); // seeded
  });
});

// ─────────────────────────────────────────────────────────────
// balances / liquid / totalBalanceBase
// ─────────────────────────────────────────────────────────────

describe("getHomeDashboard — balances and liquid", () => {
  it("reflects single RUB account balance in totalBalanceBase", async () => {
    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    // Account has 100000 RUB → totalBalanceBase should be 100000
    expect(new Prisma.Decimal(dashboard.totalBalanceBase).equals(new Prisma.Decimal("100000"))).toBe(true);
    expect(dashboard.balances).toHaveLength(1);
    expect(dashboard.balances[0].currencyCode).toBe("RUB");
    expect(new Prisma.Decimal(dashboard.balances[0].amount).equals(new Prisma.Decimal("100000"))).toBe(true);
  });

  it("sums multi-currency accounts converting to base (USD→RUB=100)", async () => {
    // Create a USD cash account with 50 USD → 50*100 = 5000 RUB in base
    await makeAccount(db, {
      currencyCode: "USD",
      balance: "50",
      kind: AccountKind.CASH,
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    // totalBalanceBase = 100000 (RUB) + 5000 (50 USD * 100) = 105000
    expect(
      new Prisma.Decimal(dashboard.totalBalanceBase).equals(new Prisma.Decimal("105000"))
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// reservedBase / freeBase
// ─────────────────────────────────────────────────────────────

describe("getHomeDashboard — reserved and free", () => {
  it("reserves active subscriptions due within 30 days", async () => {
    // Subscription due in 5 days → should be reserved
    await makeSubscription(db, {
      name: "Netflix",
      price: "500",
      currencyCode: "RUB",
      nextPaymentDate: daysFromNow(5),
      isActive: true,
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    // Reserved should include at least 500 RUB
    const reserved = new Prisma.Decimal(dashboard.reservedBase);
    expect(reserved.gte(new Prisma.Decimal("500"))).toBe(true);
    // freeBase = max(0, totalBase - reservedBase)
    const free = new Prisma.Decimal(dashboard.freeBase);
    const total = new Prisma.Decimal(dashboard.totalBalanceBase);
    // free + reserved should equal total (or free = 0 if reserved > total)
    if (free.gt(0)) {
      expect(free.plus(reserved).equals(total)).toBe(true);
    } else {
      expect(reserved.gte(total)).toBe(true);
    }
  });

  it("does not reserve subscriptions due after 30 days", async () => {
    // Subscription due in 60 days → not reserved
    await makeSubscription(db, {
      name: "Far Future",
      price: "9999",
      currencyCode: "RUB",
      nextPaymentDate: daysFromNow(60),
      isActive: true,
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    // Reserved should be 0 (no other reservations)
    expect(new Prisma.Decimal(dashboard.reservedBase).equals(new Prisma.Decimal("0"))).toBe(true);
    // freeBase = totalBalanceBase = 100000
    expect(new Prisma.Decimal(dashboard.freeBase).equals(new Prisma.Decimal("100000"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// planFactMonth — income/expense plan vs fact for current calendar month
// ─────────────────────────────────────────────────────────────

describe("getHomeDashboard — planFactMonth", () => {
  it("has zero plan/fact when no transactions in current month", async () => {
    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    const pf = dashboard.planFactMonth;
    expect(pf.inflowPlanBase).toBe("0");
    expect(pf.inflowFactBase).toBe("0");
    expect(pf.outflowPlanBase).toBe("0");
    expect(pf.outflowFactBase).toBe("0");
    expect(pf.hasInflowPlan).toBe(false);
    expect(pf.hasOutflowPlan).toBe(false);
  });

  it("counts DONE income as both plan and fact", async () => {
    // 10000 RUB income DONE within current month
    await makeTransaction(db, {
      accountId,
      categoryId: salaryCatId,
      kind: TransactionKind.INCOME,
      amount: "10000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysAgo(3), // within current calendar month (recent)
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    const pf = dashboard.planFactMonth;
    expect(new Prisma.Decimal(pf.inflowPlanBase).equals(new Prisma.Decimal("10000"))).toBe(true);
    expect(new Prisma.Decimal(pf.inflowFactBase).equals(new Prisma.Decimal("10000"))).toBe(true);
    expect(pf.hasInflowPlan).toBe(true);
  });

  it("counts DONE expense as both outflowPlan and outflowFact", async () => {
    // 5000 RUB expense DONE
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysAgo(2),
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    const pf = dashboard.planFactMonth;
    expect(new Prisma.Decimal(pf.outflowPlanBase).equals(new Prisma.Decimal("5000"))).toBe(true);
    expect(new Prisma.Decimal(pf.outflowFactBase).equals(new Prisma.Decimal("5000"))).toBe(true);
    expect(pf.hasOutflowPlan).toBe(true);
  });

  it("PLANNED status counts as plan but NOT fact", async () => {
    // 8000 RUB PLANNED — counted in plan, not in fact
    await makeTransaction(db, {
      accountId,
      categoryId: salaryCatId,
      kind: TransactionKind.INCOME,
      amount: "8000",
      currencyCode: "RUB",
      status: TransactionStatus.PLANNED,
      occurredAt: daysAgo(1),
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    const pf = dashboard.planFactMonth;
    expect(new Prisma.Decimal(pf.inflowPlanBase).equals(new Prisma.Decimal("8000"))).toBe(true);
    expect(pf.inflowFactBase).toBe("0");
  });
});

// ─────────────────────────────────────────────────────────────
// upcomingObligations30d
// ─────────────────────────────────────────────────────────────

describe("getHomeDashboard — upcomingObligations30d", () => {
  it("includes active subscription due within 30 days", async () => {
    await makeSubscription(db, {
      name: "Spotify",
      price: "300",
      currencyCode: "RUB",
      nextPaymentDate: daysFromNow(7),
      isActive: true,
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    const subObligation = dashboard.upcomingObligations30d.find(
      (o) => o.kind === "subscription" && o.label === "Spotify"
    );
    expect(subObligation).toBeDefined();
    expect(new Prisma.Decimal(subObligation!.amount).equals(new Prisma.Decimal("300"))).toBe(true);
  });

  it("excludes subscription due after 30 days", async () => {
    await makeSubscription(db, {
      name: "Annual Plan",
      price: "9999",
      currencyCode: "RUB",
      nextPaymentDate: daysFromNow(45),
      isActive: true,
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    const found = dashboard.upcomingObligations30d.find(
      (o) => o.label === "Annual Plan"
    );
    expect(found).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// topCategoriesDelta
// ─────────────────────────────────────────────────────────────

describe("getHomeDashboard — topCategoriesDelta", () => {
  it("shows current month expenses with no prev month as deltaPct=null", async () => {
    // Only current-month expense; no prev-month expense for this category
    await makeTransaction(db, {
      accountId,
      categoryId: diningCatId,
      kind: TransactionKind.EXPENSE,
      amount: "3000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysAgo(3),
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    const dining = dashboard.topCategoriesDelta.find(
      (c) => c.categoryId === diningCatId
    );
    expect(dining).toBeDefined();
    expect(new Prisma.Decimal(dining!.currentMonthBase).equals(new Prisma.Decimal("3000"))).toBe(true);
    // No previous month → deltaPct = null
    expect(dining!.deltaPct).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Transfer + CompensationGroup invariant
// ─────────────────────────────────────────────────────────────

describe("getHomeDashboard — transfer and compensation exclusion (INVARIANT)", () => {
  it("excludes transfer legs from planFactMonth income and expense", async () => {
    const usdAccount = await makeAccount(db, {
      currencyCode: "USD",
      balance: "1000",
      kind: AccountKind.CASH,
    });

    // Create a transfer: 10000 RUB → 100 USD
    const transfer = await db.transfer.create({
      data: {
        userId: DEFAULT_USER_ID,
        fromAccountId: accountId,
        toAccountId: usdAccount.id,
        fromAmount: new Prisma.Decimal("10000"),
        toAmount: new Prisma.Decimal("100"),
        fromCcy: "RUB",
        toCcy: "USD",
        rate: new Prisma.Decimal("0.01"),
        fee: null,
        occurredAt: daysAgo(3),
      },
      select: { id: true },
    });

    // Create transfer legs (these should be EXCLUDED from income/expense aggregation)
    await db.transaction.create({
      data: {
        userId: DEFAULT_USER_ID,
        accountId,
        kind: TransactionKind.EXPENSE,
        status: TransactionStatus.DONE,
        amount: new Prisma.Decimal("10000"),
        currencyCode: "RUB",
        occurredAt: daysAgo(3),
        name: "Transfer out (RUB)",
        transferId: transfer.id,
      },
    });
    await db.transaction.create({
      data: {
        userId: DEFAULT_USER_ID,
        accountId: usdAccount.id,
        kind: TransactionKind.INCOME,
        status: TransactionStatus.DONE,
        amount: new Prisma.Decimal("100"),
        currencyCode: "USD",
        occurredAt: daysAgo(3),
        name: "Transfer in (USD)",
        transferId: transfer.id,
      },
    });

    // Also add a real income transaction so we can distinguish 0 vs exclusion
    await makeTransaction(db, {
      accountId,
      categoryId: salaryCatId,
      kind: TransactionKind.INCOME,
      amount: "20000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysAgo(2),
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");
    const pf = dashboard.planFactMonth;

    // Only the 20000 salary income should count — transfer IN (100 USD=10000 RUB) excluded
    expect(new Prisma.Decimal(pf.inflowFactBase).equals(new Prisma.Decimal("20000"))).toBe(true);
    // Transfer OUT (10000 RUB) excluded — outflowFact should be 0
    expect(new Prisma.Decimal(pf.outflowFactBase).equals(new Prisma.Decimal("0"))).toBe(true);
  });

  it("excludes compensation non-main legs from topCategoriesDelta", async () => {
    // A compensation group has a main txn (expense 5000) and an offsetting income leg (1000).
    // The CompensationProjection excludes non-main legs. The main leg amount is rewritten to netto.
    // We create this manually to test the invariant.
    //
    // Main leg: EXPENSE 5000 RUB (for Dining Out)
    // Offset leg: INCOME 1000 RUB (compensation refund)
    // → nettoBase = 4000 RUB, sign = -1 (expense wins)
    // Non-main (income) leg should be excluded from topCategoriesDelta.

    // Create main expense txn
    const mainTxn = await db.transaction.create({
      data: {
        userId: DEFAULT_USER_ID,
        accountId,
        categoryId: diningCatId,
        kind: TransactionKind.EXPENSE,
        status: TransactionStatus.DONE,
        amount: new Prisma.Decimal("5000"),
        currencyCode: "RUB",
        occurredAt: daysAgo(2),
        name: "Business dinner",
      },
      select: { id: true },
    });

    // Create income (refund) leg
    const refundTxn = await db.transaction.create({
      data: {
        userId: DEFAULT_USER_ID,
        accountId,
        kind: TransactionKind.INCOME,
        status: TransactionStatus.DONE,
        amount: new Prisma.Decimal("1000"),
        currencyCode: "RUB",
        occurredAt: daysAgo(2),
        name: "Partial refund",
      },
      select: { id: true },
    });

    // Create CompensationGroup linking them
    const group = await db.compensationGroup.create({
      data: {
        userId: DEFAULT_USER_ID,
        mainTxnId: mainTxn.id,
        nettoBase: new Prisma.Decimal("4000"),
        nettoSign: -1, // expense wins
        baseCcy: "RUB",
        occurredAt: daysAgo(2),
        kind: "COMPENSATION",
        categoryIdForAggregation: diningCatId,
      },
      select: { id: true },
    });

    // Link both transactions to the group
    await db.transaction.update({
      where: { id: mainTxn.id },
      data: { compensationGroupId: group.id },
    });
    await db.transaction.update({
      where: { id: refundTxn.id },
      data: { compensationGroupId: group.id },
    });

    const dashboard = await getHomeDashboard(DEFAULT_USER_ID, "RUB");

    // topCategoriesDelta should show Dining Out with netto=4000 (not 5000)
    const dining = dashboard.topCategoriesDelta.find(
      (c) => c.categoryId === diningCatId
    );
    expect(dining).toBeDefined();
    // The main leg is rewritten to nettoBase=4000 by the compensation projection
    expect(new Prisma.Decimal(dining!.currentMonthBase).equals(new Prisma.Decimal("4000"))).toBe(true);

    // planFactMonth outflow should also be netto=4000, not 5000
    // (The refund income leg at 1000 is a non-main and excluded)
    const pf = dashboard.planFactMonth;
    expect(new Prisma.Decimal(pf.outflowFactBase).equals(new Prisma.Decimal("4000"))).toBe(true);
    // The non-main income leg (1000) must NOT appear in inflowFact
    expect(new Prisma.Decimal(pf.inflowFactBase).equals(new Prisma.Decimal("0"))).toBe(true);
  });
});
