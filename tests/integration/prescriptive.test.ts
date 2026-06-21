/**
 * integration/prescriptive.test.ts
 *
 * Tests for analytics-prescriptive.ts:
 *   - getBurnRate (perDay30d, daysToZero)
 *   - getObligatoryDiscretionarySplit (essential vs discretionary split)
 *   - getShrinkableCategories (basic sanity — overspend detection)
 *
 * Note on getBurnRate: it always uses DEFAULT_CURRENCY (RUB) for getAvailableNow,
 * so we always create RUB accounts and use "RUB" as baseCcy.
 *
 * Note on getShrinkableCategories / getEconomyExitScenario: these depend on
 * getCompareSparklines (6 months of expense history). We build 6 monthly snapshots
 * and assert the expected overspend detection behavior.
 *
 * Fixed anchor: NOW = 2026-06-15T12:00:00Z
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { makeAccount, makeTransaction } from "@/tests/fixtures/builders";
import { AccountKind } from "@prisma/client";
import {
  getBurnRate,
  getShrinkableCategories,
  getObligatoryDiscretionarySplit,
} from "@/lib/data/analytics-prescriptive";
import type { DateRange } from "@/lib/data/analytics";

const NOW = new Date("2026-06-15T12:00:00Z");
const TZ = "Europe/Moscow";

function daysFromNow(n: number): Date {
  return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
}

// Build a date exactly N months before NOW (approximate: 30d per month)
function monthsAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 30 * 24 * 60 * 60 * 1000);
}

let accountId: string;
let groceriesCatId: string; // essential = true
let diningCatId: string; // essential = false
let entertainmentCatId: string; // essential = false

beforeEach(async () => {
  // Use CASH kind so getAvailableNow picks it up via getCashStash (no institution needed)
  const account = await makeAccount(db, {
    balance: "100000",
    currencyCode: "RUB",
    kind: AccountKind.CASH,
  });
  accountId = account.id;

  const groceriesCat = await db.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name: "Groceries", kind: "EXPENSE" },
    select: { id: true },
  });
  const diningCat = await db.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name: "Dining Out", kind: "EXPENSE" },
    select: { id: true },
  });
  const entertainmentCat = await db.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name: "Entertainment", kind: "EXPENSE" },
    select: { id: true },
  });

  if (!groceriesCat || !diningCat || !entertainmentCat) {
    throw new Error("Required seeded categories not found");
  }

  groceriesCatId = groceriesCat.id;
  diningCatId = diningCat.id;
  entertainmentCatId = entertainmentCat.id;
});

// ─────────────────────────────────────────────────────────────
// getBurnRate
// ─────────────────────────────────────────────────────────────

describe("getBurnRate", () => {
  it("returns zero burn rate and null daysToZero when no expenses", async () => {
    const result = await getBurnRate(DEFAULT_USER_ID, "RUB", TZ, NOW);
    expect(result.perDay30dBase).toBe("0");
    expect(result.perDay90dBase).toBe("0");
    // daysToZero is null when perDay30 = 0
    expect(result.daysToZero).toBeNull();
  });

  it("computes perDay30dBase = outflow30 / 30", async () => {
    // 3000 RUB expense in last 30 days → perDay30 = 3000/30 = 100
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "3000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5),
    });

    const result = await getBurnRate(DEFAULT_USER_ID, "RUB", TZ, NOW);
    // perDay30 = 3000 / 30 = 100
    expect(new Prisma.Decimal(result.perDay30dBase).equals(new Prisma.Decimal("100"))).toBe(true);
  });

  it("computes daysToZero = floor(freeBase / perDay30)", async () => {
    // Account balance = 100000 RUB, no reservations
    // 3000 RUB expense in last 30d → perDay30 = 100
    // freeBase = 100000 (no reservations), daysToZero = floor(100000/100) = 1000
    await makeTransaction(db, {
      accountId,
      categoryId: diningCatId,
      kind: TransactionKind.EXPENSE,
      amount: "3000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-10),
    });

    const result = await getBurnRate(DEFAULT_USER_ID, "RUB", TZ, NOW);
    expect(result.daysToZero).not.toBeNull();
    // floor(100000 / 100) = 1000
    expect(result.daysToZero).toBe(1000);
    expect(result.alreadyNegative).toBe(false);
  });

  it("returns alreadyNegative=true when freeBase <= 0", async () => {
    // Create account with zero balance → freeBase = 0
    const zeroAccount = await makeAccount(db, {
      balance: "0",
      currencyCode: "RUB",
    });

    // Overwrite the first account balance to 0
    await db.account.updateMany({
      where: { userId: DEFAULT_USER_ID },
      data: { balance: new Prisma.Decimal("0") },
    });

    const result = await getBurnRate(DEFAULT_USER_ID, "RUB", TZ, NOW);
    // freeBase = 0 → alreadyNegative = true (lte(0))
    expect(result.alreadyNegative).toBe(true);
    expect(result.daysToZero).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// getObligatoryDiscretionarySplit
// ─────────────────────────────────────────────────────────────

describe("getObligatoryDiscretionarySplit", () => {
  it("returns zero split when no expenses", async () => {
    const range: DateRange = { from: daysFromNow(-30), to: NOW };
    const result = await getObligatoryDiscretionarySplit(DEFAULT_USER_ID, range, "RUB", TZ);
    expect(result.obligatoryBase).toBe("0");
    expect(result.discretionaryBase).toBe("0");
    expect(result.totalBase).toBe("0");
    expect(result.discretionaryPct).toBe(0);
  });

  it("correctly splits essential vs discretionary", async () => {
    // Groceries (essential): 6000 RUB → obligatory
    // Dining (discretionary): 4000 RUB → discretionary
    // total = 10000, discretionaryPct = 40%
    const range: DateRange = { from: daysFromNow(-30), to: NOW };

    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "6000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5),
    });
    await makeTransaction(db, {
      accountId,
      categoryId: diningCatId,
      kind: TransactionKind.EXPENSE,
      amount: "4000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-3),
    });

    const result = await getObligatoryDiscretionarySplit(DEFAULT_USER_ID, range, "RUB", TZ);
    // obligatory = 6000 (Groceries, essential=true)
    expect(new Prisma.Decimal(result.obligatoryBase).equals(new Prisma.Decimal("6000"))).toBe(true);
    // discretionary = 4000 (Dining, essential=false)
    expect(new Prisma.Decimal(result.discretionaryBase).equals(new Prisma.Decimal("4000"))).toBe(true);
    // total = 10000
    expect(new Prisma.Decimal(result.totalBase).equals(new Prisma.Decimal("10000"))).toBe(true);
    // discretionaryPct = round(4000/10000 * 100) = 40
    expect(result.discretionaryPct).toBe(40);
  });

  it("uncategorized expense counts as discretionary", async () => {
    // A transaction without categoryId → should be discretionary
    const range: DateRange = { from: daysFromNow(-30), to: NOW };

    await db.transaction.create({
      data: {
        userId: DEFAULT_USER_ID,
        accountId,
        categoryId: null, // no category
        kind: TransactionKind.EXPENSE,
        status: TransactionStatus.DONE,
        amount: new Prisma.Decimal("2000"),
        currencyCode: "RUB",
        occurredAt: daysFromNow(-5),
        name: "Uncategorized expense",
      },
    });

    const result = await getObligatoryDiscretionarySplit(DEFAULT_USER_ID, range, "RUB", TZ);
    expect(new Prisma.Decimal(result.obligatoryBase).equals(new Prisma.Decimal("0"))).toBe(true);
    expect(new Prisma.Decimal(result.discretionaryBase).equals(new Prisma.Decimal("2000"))).toBe(true);
    expect(result.discretionaryPct).toBe(100);
  });

  it("excludes transfer legs from split (transfer invariant)", async () => {
    const range: DateRange = { from: daysFromNow(-30), to: NOW };

    const transfer = await db.transfer.create({
      data: {
        userId: DEFAULT_USER_ID,
        fromAccountId: accountId,
        toAccountId: accountId,
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
        name: "Transfer leg",
        transferId: transfer.id,
      },
    });

    const result = await getObligatoryDiscretionarySplit(DEFAULT_USER_ID, range, "RUB", TZ);
    // Transfer leg excluded → both should be zero
    expect(result.obligatoryBase).toBe("0");
    expect(result.discretionaryBase).toBe("0");
  });

  it("multi-currency expenses convert to base correctly", async () => {
    // Groceries: 2 EUR = 220 RUB (essential/obligatory)
    // Dining: 10 USD = 1000 RUB (discretionary)
    // total = 1220 RUB, discretionaryPct = round(1000/1220 * 100) = 82%
    const range: DateRange = { from: daysFromNow(-30), to: NOW };

    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "2",
      currencyCode: "EUR",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-5),
    });
    await makeTransaction(db, {
      accountId,
      categoryId: diningCatId,
      kind: TransactionKind.EXPENSE,
      amount: "10",
      currencyCode: "USD",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-3),
    });

    const result = await getObligatoryDiscretionarySplit(DEFAULT_USER_ID, range, "RUB", TZ);
    // 2 EUR * 110 = 220 obligatory
    expect(new Prisma.Decimal(result.obligatoryBase).equals(new Prisma.Decimal("220"))).toBe(true);
    // 10 USD * 100 = 1000 discretionary
    expect(new Prisma.Decimal(result.discretionaryBase).equals(new Prisma.Decimal("1000"))).toBe(true);
    // total = 1220, pct = round(1000/1220*100) = 82
    expect(new Prisma.Decimal(result.totalBase).equals(new Prisma.Decimal("1220"))).toBe(true);
    expect(result.discretionaryPct).toBe(82);
  });
});

// ─────────────────────────────────────────────────────────────
// getShrinkableCategories
// Requires 6 months of data. Series[5] = current month,
// Series[0..4] = past 5 months. Overspend when current > avg(first5).
// ─────────────────────────────────────────────────────────────

describe("getShrinkableCategories", () => {
  it("detects overspending category when current month exceeds 5-month avg", async () => {
    // Build 6 expense buckets for Dining Out (discretionary):
    // months 5-1 ago: 2000 RUB each (avg = 2000)
    // current month (bucket 6, index 5): 4000 RUB (overspend by 2000, 100%)
    // getCompareSparklines uses now.getTime() — we pass NOW to getShrinkableCategories
    // which passes it to getCompareSparklines(userId, baseCcy, tz, RUNWAY_AVG_MONTHS=6, now.getTime())

    for (let i = 5; i >= 1; i--) {
      await makeTransaction(db, {
        accountId,
        categoryId: diningCatId,
        kind: TransactionKind.EXPENSE,
        amount: "2000",
        currencyCode: "RUB",
        status: TransactionStatus.DONE,
        occurredAt: monthsAgo(i),
      });
    }
    // Current month (within 0-30 days of NOW)
    await makeTransaction(db, {
      accountId,
      categoryId: diningCatId,
      kind: TransactionKind.EXPENSE,
      amount: "4000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-2),
    });

    const result = await getShrinkableCategories(DEFAULT_USER_ID, "RUB", TZ, NOW);
    // Dining Out should appear as shrinkable (overspending)
    const dining = result.find((r) => r.categoryId === diningCatId);
    expect(dining).toBeDefined();
    // overspend ≈ 4000 - 2000 = 2000
    expect(Number(dining!.overspendBase)).toBeCloseTo(2000, 0);
    // overspendPct ≈ 100%
    expect(dining!.overspendPct).toBeGreaterThan(50);
  });

  it("excludes category that does not overspend", async () => {
    // Groceries: 5 months at 5000, current at 4000 — below avg, not shrinkable
    for (let i = 5; i >= 1; i--) {
      await makeTransaction(db, {
        accountId,
        categoryId: groceriesCatId,
        kind: TransactionKind.EXPENSE,
        amount: "5000",
        currencyCode: "RUB",
        status: TransactionStatus.DONE,
        occurredAt: monthsAgo(i),
      });
    }
    await makeTransaction(db, {
      accountId,
      categoryId: groceriesCatId,
      kind: TransactionKind.EXPENSE,
      amount: "4000",
      currencyCode: "RUB",
      status: TransactionStatus.DONE,
      occurredAt: daysFromNow(-2),
    });

    const result = await getShrinkableCategories(DEFAULT_USER_ID, "RUB", TZ, NOW);
    const groceries = result.find((r) => r.categoryId === groceriesCatId);
    // Should not be shrinkable (current < avg)
    expect(groceries).toBeUndefined();
  });
});
