/**
 * integration/analytics.test.ts
 *
 * Tests for analytics.ts: getPeriodKpis, getCategoryPie, getPeriodCompare,
 * getTrendPoints.
 *
 * Fixed anchor: now = 2026-06-15T12:00:00Z, tz = "Europe/Moscow"
 * All transaction dates are relative to this anchor.
 *
 * Seeded reference data used:
 *   - DEFAULT_USER_ID = "usr_default_single"
 *   - USD→RUB = 100, EUR→RUB = 110
 *   - Categories: "Groceries" (essential), "Dining Out" (discretionary), "Salary" (INCOME)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { makeAccount, makeTransaction } from "@/tests/fixtures/builders";
import {
  getPeriodKpis,
  getCategoryPie,
  getPeriodCompare,
  getTrendPoints,
  type DateRange,
} from "@/lib/data/analytics";

// Fixed anchor — do NOT use Date.now()
const NOW = new Date("2026-06-15T12:00:00Z");
const TZ = "Europe/Moscow";

// Helper: a date N days relative to NOW (negative = past)
function daysFromNow(n: number): Date {
  return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
}

// Range: last 30 days ending at NOW
const RANGE_30D: DateRange = {
  from: daysFromNow(-30),
  to: NOW,
};

// Previous 30-day range (for compare tests)
const RANGE_PREV_30D: DateRange = {
  from: daysFromNow(-60),
  to: daysFromNow(-30),
};

let accountId: string;
let salaryCatId: string;
let groceriesCatId: string;
let diningCatId: string;

beforeEach(async () => {
  // Create a test account (RUB, 100000 balance)
  const account = await makeAccount(db, {
    balance: "100000",
    currencyCode: "RUB",
  });
  accountId = account.id;

  // Resolve category IDs from the seeded categories
  const salaryCategory = await db.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name: "Salary", kind: "INCOME" },
    select: { id: true },
  });
  const groceriesCategory = await db.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name: "Groceries", kind: "EXPENSE" },
    select: { id: true },
  });
  const diningCategory = await db.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name: "Dining Out", kind: "EXPENSE" },
    select: { id: true },
  });

  if (!salaryCategory || !groceriesCategory || !diningCategory) {
    throw new Error("Required seeded categories not found");
  }

  salaryCatId = salaryCategory.id;
  groceriesCatId = groceriesCategory.id;
  diningCatId = diningCategory.id;
});

// ─────────────────────────────────────────────────────────────
// getPeriodKpis
// ─────────────────────────────────────────────────────────────

describe("getPeriodKpis", () => {
  it("returns zero KPIs when no transactions in range", async () => {
    const kpis = await getPeriodKpis(DEFAULT_USER_ID, RANGE_30D, "RUB");
    expect(kpis.inflowBase).toBe("0");
    expect(kpis.outflowBase).toBe("0");
    expect(kpis.netBase).toBe("0");
    expect(kpis.savingsRatePct).toBeNull();
  });

  it("aggregates INCOME and EXPENSE in base currency", async () => {
    // 10000 RUB income + 4000 RUB expense → net = 6000
    // savingsRate = 6000/10000 * 100 = 60%
    await makeTransaction(db, {
      accountId,
      categoryId: salaryCatId,
      kind: TransactionKind.INCOME,
      amount: "10000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5),
    });
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "4000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-3),
    });

    const kpis = await getPeriodKpis(DEFAULT_USER_ID, RANGE_30D, "RUB");
    // inflowBase = 10000 RUB
    expect(new Prisma.Decimal(kpis.inflowBase).equals(new Prisma.Decimal("10000"))).toBe(true);
    // outflowBase = 4000 RUB
    expect(new Prisma.Decimal(kpis.outflowBase).equals(new Prisma.Decimal("4000"))).toBe(true);
    // net = 6000 RUB
    expect(new Prisma.Decimal(kpis.netBase).equals(new Prisma.Decimal("6000"))).toBe(true);
    // savingsRate = 60%
    expect(kpis.savingsRatePct).toBeCloseTo(60, 1);
  });

  it("converts multi-currency to base (USD expense → RUB)", async () => {
    // 50 USD expense * 100 (rate) = 5000 RUB outflow
    // 20000 RUB income
    // net = 20000 - 5000 = 15000, savings = 75%
    await makeTransaction(db, {
      accountId,
      categoryId: salaryCatId,
      kind: TransactionKind.INCOME,
      amount: "20000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-10),
    });
    await makeTransaction(db, {
      accountId,
      categoryId: diningCatId,
      kind: TransactionKind.EXPENSE,
      amount: "50",
      currencyCode: "USD",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-8),
    });

    const kpis = await getPeriodKpis(DEFAULT_USER_ID, RANGE_30D, "RUB");
    // 50 USD * 100 = 5000 RUB
    expect(new Prisma.Decimal(kpis.outflowBase).equals(new Prisma.Decimal("5000"))).toBe(true);
    expect(new Prisma.Decimal(kpis.inflowBase).equals(new Prisma.Decimal("20000"))).toBe(true);
    expect(new Prisma.Decimal(kpis.netBase).equals(new Prisma.Decimal("15000"))).toBe(true);
    expect(kpis.savingsRatePct).toBeCloseTo(75, 1);
  });

  it("excludes transactions outside the range", async () => {
    // Transaction 60 days ago — outside RANGE_30D
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-60),
    });
    // Transaction within range
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "3000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5),
    });

    const kpis = await getPeriodKpis(DEFAULT_USER_ID, RANGE_30D, "RUB");
    // Only the 3000 within range
    expect(new Prisma.Decimal(kpis.outflowBase).equals(new Prisma.Decimal("3000"))).toBe(true);
  });

  it("excludes TRANSFER-linked transactions (transfer invariant)", async () => {
    // A transfer is created with makeTransfer — it generates two Transaction rows
    // each with a transferId; loadPeriodTxns (variant=flow) filters transferId=null.
    // The account USD will receive the toAmount, the RUB account sends fromAmount.
    const usdAccount = await makeAccount(db, {
      currencyCode: "USD",
      balance: "1000",
    });

    // Manually create a transfer record (builders.ts makeTransfer)
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
        occurredAt: daysFromNow(-5),
      },
      select: { id: true },
    });

    // Create EXPENSE transfer legs with transferId set
    await db.transaction.create({
      data: {
        userId: DEFAULT_USER_ID,
        accountId,
        kind: TransactionKind.EXPENSE,
        status: TransactionStatus.DONE,
        amount: new Prisma.Decimal("10000"),
        currencyCode: "RUB",
        occurredAt: daysFromNow(-5),
        name: "Transfer out",
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
        occurredAt: daysFromNow(-5),
        name: "Transfer in",
        transferId: transfer.id,
      },
    });

    // Also a normal income transaction to ensure non-zero result
    await makeTransaction(db, {
      accountId,
      categoryId: salaryCatId,
      kind: TransactionKind.INCOME,
      amount: "5000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-3),
    });

    const kpis = await getPeriodKpis(DEFAULT_USER_ID, RANGE_30D, "RUB");
    // Transfer legs MUST be excluded; only the 5000 income counts
    expect(new Prisma.Decimal(kpis.inflowBase).equals(new Prisma.Decimal("5000"))).toBe(true);
    // Outflow = 0 (transfer leg excluded)
    expect(new Prisma.Decimal(kpis.outflowBase).equals(new Prisma.Decimal("0"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// getCategoryPie
// ─────────────────────────────────────────────────────────────

describe("getCategoryPie", () => {
  it("returns empty array when no expenses", async () => {
    const slices = await getCategoryPie(DEFAULT_USER_ID, RANGE_30D, "RUB");
    expect(slices).toHaveLength(0);
  });

  it("slices sum to total and per-category amounts are correct", async () => {
    // Groceries: 6000 RUB, Dining: 4000 RUB → total = 10000
    // Groceries pct = 60%, Dining pct = 40%
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "6000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-10),
    });
    await makeTransaction(db, {
      accountId,
      categoryId: diningCatId,
      kind: TransactionKind.EXPENSE,
      amount: "4000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-8),
    });

    const slices = await getCategoryPie(DEFAULT_USER_ID, RANGE_30D, "RUB");
    expect(slices.length).toBeGreaterThanOrEqual(2);

    const pctSum = slices.reduce((acc, s) => acc + s.pct, 0);
    // Pcts should sum to ~100 (rounded to 1 decimal each, so within a rounding margin)
    expect(pctSum).toBeCloseTo(100, 0);

    const groceries = slices.find((s) => s.categoryId === groceriesCatId);
    const dining = slices.find((s) => s.categoryId === diningCatId);

    expect(groceries).toBeDefined();
    expect(dining).toBeDefined();

    // amountBase: Groceries=6000, Dining=4000
    expect(new Prisma.Decimal(groceries!.amountBase).equals(new Prisma.Decimal("6000"))).toBe(true);
    expect(new Prisma.Decimal(dining!.amountBase).equals(new Prisma.Decimal("4000"))).toBe(true);

    // pct: Groceries=60, Dining=40
    expect(groceries!.pct).toBeCloseTo(60, 0);
    expect(dining!.pct).toBeCloseTo(40, 0);
  });

  it("excludes income transactions from the pie", async () => {
    await makeTransaction(db, {
      accountId,
      categoryId: salaryCatId,
      kind: TransactionKind.INCOME,
      amount: "50000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5),
    });
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "2000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5),
    });

    const slices = await getCategoryPie(DEFAULT_USER_ID, RANGE_30D, "RUB");
    // Only the expense category should appear
    expect(slices.length).toBe(1);
    expect(slices[0].categoryId).toBe(groceriesCatId);
  });

  it("excludes transfer-linked transactions (transfer invariant)", async () => {
    // Create a transfer expense leg with transferId set
    const transfer = await db.transfer.create({
      data: {
        userId: DEFAULT_USER_ID,
        fromAccountId: accountId,
        toAccountId: accountId, // self-transfer for simplicity
        fromAmount: new Prisma.Decimal("5000"),
        toAmount: new Prisma.Decimal("5000"),
        fromCcy: "RUB",
        toCcy: "RUB",
        rate: new Prisma.Decimal("1"),
        fee: null,
        occurredAt: daysFromNow(-5),
      },
      select: { id: true },
    });

    await db.transaction.create({
      data: {
        userId: DEFAULT_USER_ID,
        accountId,
        categoryId: groceriesCatId,
        kind: TransactionKind.EXPENSE,
        status: TransactionStatus.DONE,
        amount: new Prisma.Decimal("5000"),
        currencyCode: "RUB",
        occurredAt: daysFromNow(-5),
        name: "Transfer expense leg",
        transferId: transfer.id,
      },
    });

    const slices = await getCategoryPie(DEFAULT_USER_ID, RANGE_30D, "RUB");
    // Transfer leg must be excluded → pie should be empty
    expect(slices).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// getPeriodCompare
// ─────────────────────────────────────────────────────────────

describe("getPeriodCompare", () => {
  it("returns 'new' kind when category only in current period", async () => {
    // Only in current range, not in previous
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "3000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5), // within RANGE_30D
    });

    const rows = await getPeriodCompare(DEFAULT_USER_ID, RANGE_30D, "RUB", RANGE_PREV_30D);
    const row = rows.find((r) => r.categoryId === groceriesCatId);
    expect(row).toBeDefined();
    expect(row!.kind).toBe("new");
    expect(row!.deltaPct).toBeNull();
    expect(new Prisma.Decimal(row!.currentBase).equals(new Prisma.Decimal("3000"))).toBe(true);
    expect(new Prisma.Decimal(row!.previousBase).equals(new Prisma.Decimal("0"))).toBe(true);
  });

  it("returns 'gone' kind when category only in previous period", async () => {
    // Only in previous range
    await makeTransaction(db, {
      accountId,
      categoryId: diningCatId,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-45), // within RANGE_PREV_30D
    });

    const rows = await getPeriodCompare(DEFAULT_USER_ID, RANGE_30D, "RUB", RANGE_PREV_30D);
    const row = rows.find((r) => r.categoryId === diningCatId);
    expect(row).toBeDefined();
    expect(row!.kind).toBe("gone");
    expect(row!.deltaPct).toBeNull();
    expect(new Prisma.Decimal(row!.previousBase).equals(new Prisma.Decimal("5000"))).toBe(true);
    expect(new Prisma.Decimal(row!.currentBase).equals(new Prisma.Decimal("0"))).toBe(true);
  });

  it("returns 'delta' with correct deltaPct when category in both periods", async () => {
    // Previous: 4000 RUB, Current: 6000 RUB
    // deltaPct = (6000-4000)/4000 * 100 = +50%
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "4000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-45), // previous range
    });
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "6000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5), // current range
    });

    const rows = await getPeriodCompare(DEFAULT_USER_ID, RANGE_30D, "RUB", RANGE_PREV_30D);
    const row = rows.find((r) => r.categoryId === groceriesCatId);
    expect(row).toBeDefined();
    expect(row!.kind).toBe("delta");
    expect(new Prisma.Decimal(row!.currentBase).equals(new Prisma.Decimal("6000"))).toBe(true);
    expect(new Prisma.Decimal(row!.previousBase).equals(new Prisma.Decimal("4000"))).toBe(true);
    // deltaPct = +50%
    expect(row!.deltaPct).toBeCloseTo(50, 1);
  });

  it("excludes transfers from compare (transfer invariant)", async () => {
    const transfer = await db.transfer.create({
      data: {
        userId: DEFAULT_USER_ID,
        fromAccountId: accountId,
        toAccountId: accountId,
        fromAmount: new Prisma.Decimal("8000"),
        toAmount: new Prisma.Decimal("8000"),
        fromCcy: "RUB",
        toCcy: "RUB",
        rate: new Prisma.Decimal("1"),
        fee: null,
        occurredAt: daysFromNow(-5),
      },
      select: { id: true },
    });
    await db.transaction.create({
      data: {
        userId: DEFAULT_USER_ID,
        accountId,
        categoryId: groceriesCatId,
        kind: TransactionKind.EXPENSE,
        status: TransactionStatus.DONE,
        amount: new Prisma.Decimal("8000"),
        currencyCode: "RUB",
        occurredAt: daysFromNow(-5),
        name: "Transfer expense leg",
        transferId: transfer.id,
      },
    });

    const rows = await getPeriodCompare(DEFAULT_USER_ID, RANGE_30D, "RUB", RANGE_PREV_30D);
    // Groceries category should not appear (transfer excluded)
    const row = rows.find((r) => r.categoryId === groceriesCatId);
    expect(row).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// getTrendPoints
// ─────────────────────────────────────────────────────────────

describe("getTrendPoints", () => {
  it("returns empty array when no transactions in range", async () => {
    const points = await getTrendPoints(DEFAULT_USER_ID, RANGE_30D, "RUB", "monthly", TZ);
    expect(points).toHaveLength(0);
  });

  it("buckets transactions by month with monthly granularity", async () => {
    // Two months: May (daysFromNow(-25)) and June (daysFromNow(-5))
    // NOW = 2026-06-15; -25 days = 2026-05-21 (May bucket), -5 days = 2026-06-10 (June bucket)
    await makeTransaction(db, {
      accountId,
      categoryId: salaryCatId,
      kind: TransactionKind.INCOME,
      amount: "10000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-25), // May
    });
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "3000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5), // June
    });

    // Range covers 30 days ending at NOW, so both are in range
    const points = await getTrendPoints(DEFAULT_USER_ID, RANGE_30D, "RUB", "monthly", TZ);
    expect(points.length).toBeGreaterThanOrEqual(1);

    // Find the June bucket (most recent)
    const juneBucket = points.find((p) => p.bucketStart.startsWith("2026-06"));
    expect(juneBucket).toBeDefined();
    expect(new Prisma.Decimal(juneBucket!.outflowBase).equals(new Prisma.Decimal("3000"))).toBe(true);

    // If May is within range (RANGE_30D from -30 days), May bucket should also exist
    const mayBucket = points.find((p) => p.bucketStart.startsWith("2026-05"));
    if (mayBucket) {
      expect(new Prisma.Decimal(mayBucket.inflowBase).equals(new Prisma.Decimal("10000"))).toBe(true);
    }
  });

  it("net = inflow - outflow within a bucket", async () => {
    // Both in same month (June): income 8000, expense 3000, net = 5000
    await makeTransaction(db, {
      accountId,
      categoryId: salaryCatId,
      kind: TransactionKind.INCOME,
      amount: "8000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5),
    });
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "3000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-3),
    });

    const points = await getTrendPoints(DEFAULT_USER_ID, RANGE_30D, "RUB", "monthly", TZ);
    expect(points.length).toBeGreaterThanOrEqual(1);

    const juneBucket = points.find((p) => p.bucketStart.startsWith("2026-06"));
    expect(juneBucket).toBeDefined();

    const net = new Prisma.Decimal(juneBucket!.inflowBase).minus(new Prisma.Decimal(juneBucket!.outflowBase));
    expect(net.equals(new Prisma.Decimal(juneBucket!.netBase))).toBe(true);
    expect(net.equals(new Prisma.Decimal("5000"))).toBe(true);
  });
});
