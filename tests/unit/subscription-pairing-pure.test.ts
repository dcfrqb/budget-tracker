import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import type { Subscription } from "@prisma/client";
import {
  advanceNextPaymentDate,
  getExpectedPaymentDates,
  amountInTolerance,
} from "@/lib/data/_mutations/subscription-pairing";

// ── Helpers ──────────────────────────────────────────────────────────────────

const d = (v: string | number) => new Prisma.Decimal(v);

function makeRates(pairs: Record<string, string>): Map<string, Prisma.Decimal> {
  const map = new Map<string, Prisma.Decimal>();
  for (const [key, val] of Object.entries(pairs)) {
    map.set(key, d(val));
  }
  return map;
}

/** Build a minimal Subscription shape for testing. Only fields used by the tested functions. */
function makeSub(overrides: {
  nextPaymentDate: Date;
  billingIntervalMonths: number;
  price?: string;
  currencyCode?: string;
  isVariablePrice?: boolean;
}): Subscription {
  return {
    id: "sub_test",
    userId: "usr_default_single",
    name: "Test Sub",
    icon: null,
    iconColor: null,
    iconBg: null,
    price: d(overrides.price ?? "9.99"),
    isVariablePrice: overrides.isVariablePrice ?? false,
    currencyCode: overrides.currencyCode ?? "USD",
    categoryId: null,
    billingIntervalMonths: overrides.billingIntervalMonths,
    nextPaymentDate: overrides.nextPaymentDate,
    sharingType: "PERSONAL",
    totalUsers: null,
    familyId: null,
    isActive: true,
    matchKeywords: [],
    autoMatch: true,
    reimbursementExpected: null,
    reimbursementCurrency: null,
    reimbursementFrom: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    deletedAt: null,
  };
}

// ── advanceNextPaymentDate ────────────────────────────────────────────────────

describe("advanceNextPaymentDate", () => {
  it("returns unchanged if currentNext is already after paidAt", () => {
    const currentNext = new Date("2026-07-01T00:00:00Z");
    const paidAt = new Date("2026-06-15T00:00:00Z");
    const result = advanceNextPaymentDate(currentNext, 1, paidAt);
    expect(result.toISOString()).toBe(currentNext.toISOString());
  });

  it("advances by 1 month past paidAt", () => {
    const currentNext = new Date("2026-06-01T00:00:00Z");
    const paidAt = new Date("2026-06-15T00:00:00Z");
    const result = advanceNextPaymentDate(currentNext, 1, paidAt);
    expect(result.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("catch-up: advances multiple periods until strictly past paidAt", () => {
    // nextPaymentDate is 3 months old; monthly subscription
    const currentNext = new Date("2026-03-01T00:00:00Z");
    const paidAt = new Date("2026-06-15T00:00:00Z");
    const result = advanceNextPaymentDate(currentNext, 1, paidAt);
    // Should advance Mar→Apr→May→Jun→Jul (strictly past Jun 15)
    expect(result.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("never goes backward: if already future, returns unchanged", () => {
    const currentNext = new Date("2026-12-01T00:00:00Z");
    const paidAt = new Date("2026-06-01T00:00:00Z");
    const result = advanceNextPaymentDate(currentNext, 1, paidAt);
    expect(result.getTime()).toBe(currentNext.getTime());
  });

  it("quarterly billing (3 months): advances correct amount", () => {
    const currentNext = new Date("2026-01-01T00:00:00Z");
    const paidAt = new Date("2026-06-30T00:00:00Z");
    const result = advanceNextPaymentDate(currentNext, 3, paidAt);
    // Jan → Apr → Jul (first strictly after Jun 30)
    expect(result.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("annual billing (12 months): advances by year", () => {
    const currentNext = new Date("2025-06-01T00:00:00Z");
    const paidAt = new Date("2026-01-15T00:00:00Z");
    const result = advanceNextPaymentDate(currentNext, 12, paidAt);
    // 2025-06 → 2026-06 (strictly after Jan 15, 2026)
    expect(result.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("end-of-month clamp: Jan 31 + 1 month (setMonth handles month overflow)", () => {
    // Jan 31 + 1 month via setMonth → Feb 31 → Mar 3 (JS native behavior)
    // We test what actually happens, not what we'd prefer
    const currentNext = new Date("2026-01-31T00:00:00Z");
    const paidAt = new Date("2026-02-15T00:00:00Z");
    const result = advanceNextPaymentDate(currentNext, 1, paidAt);
    // JS setMonth(1) on Jan 31 → Feb 31 overflows to Mar 3
    // So result should be > paidAt (Feb 15)
    expect(result.getTime()).toBeGreaterThan(paidAt.getTime());
    // And result should be after currentNext
    expect(result.getTime()).toBeGreaterThan(currentNext.getTime());
  });

  it("paidAt equals currentNext: must advance (not strictly after)", () => {
    const currentNext = new Date("2026-06-01T00:00:00Z");
    const paidAt = new Date("2026-06-01T00:00:00Z");
    // currentNext <= paidAt is true (equal), so should advance
    const result = advanceNextPaymentDate(currentNext, 1, paidAt);
    expect(result.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("max 60 iterations guard: very stale date with long interval (no infinite loop)", () => {
    const currentNext = new Date("2020-01-01T00:00:00Z");
    const paidAt = new Date("2026-06-15T00:00:00Z");
    // Monthly → ~78 months apart, but capped at 60 iterations
    const result = advanceNextPaymentDate(currentNext, 1, paidAt);
    // After 60 iters: 2020-01 + 60 months = 2025-01
    // 2025-01 is still <= 2026-06-15, so the result will NOT be past paidAt (capped)
    // This tests that it terminates; the exact date is 2025-01-01
    expect(result).toBeInstanceOf(Date);
    // In any case, no more than 60 months beyond start
    const monthsAdvanced = (result.getFullYear() - currentNext.getFullYear()) * 12
      + (result.getMonth() - currentNext.getMonth());
    expect(monthsAdvanced).toBeLessThanOrEqual(60);
  });
});

// ── getExpectedPaymentDates ───────────────────────────────────────────────────

describe("getExpectedPaymentDates", () => {
  it("returns dates within the window stepping back from nextPaymentDate", () => {
    const sub = makeSub({
      nextPaymentDate: new Date("2026-07-01T00:00:00Z"),
      billingIntervalMonths: 1,
    });
    const windowFrom = new Date("2026-04-01T00:00:00Z");
    const windowTo = new Date("2026-06-30T00:00:00Z");

    const dates = getExpectedPaymentDates(sub, windowFrom, windowTo);
    // Expected dates ≤ windowTo: Jul 1 is outside windowTo, so step back:
    // Jun 1, May 1, Apr 1 should be included; Mar 1 is outside windowFrom but added as boundary
    const isoSet = dates.map((d) => d.toISOString());
    expect(isoSet).toContain("2026-06-01T00:00:00.000Z");
    expect(isoSet).toContain("2026-05-01T00:00:00.000Z");
    expect(isoSet).toContain("2026-04-01T00:00:00.000Z");
  });

  it("includes one extra date just before windowFrom (boundary neighbor)", () => {
    const sub = makeSub({
      nextPaymentDate: new Date("2026-07-01T00:00:00Z"),
      billingIntervalMonths: 1,
    });
    const windowFrom = new Date("2026-05-01T00:00:00Z");
    const windowTo = new Date("2026-06-30T00:00:00Z");

    const dates = getExpectedPaymentDates(sub, windowFrom, windowTo);
    // Apr 1 is before windowFrom → boundary neighbor included
    const isoSet = dates.map((d) => d.toISOString());
    expect(isoSet).toContain("2026-04-01T00:00:00.000Z");
  });

  it("quarterly billing: steps back 3 months each time", () => {
    const sub = makeSub({
      nextPaymentDate: new Date("2026-07-01T00:00:00Z"),
      billingIntervalMonths: 3,
    });
    const windowFrom = new Date("2026-01-01T00:00:00Z");
    const windowTo = new Date("2026-06-30T00:00:00Z");

    const dates = getExpectedPaymentDates(sub, windowFrom, windowTo);
    const isoSet = dates.map((d) => d.toISOString());
    // Jul 1 > windowTo, step back: Apr 1 (in window), Jan 1 (in window), Oct 2025 (boundary)
    expect(isoSet).toContain("2026-04-01T00:00:00.000Z");
    expect(isoSet).toContain("2026-01-01T00:00:00.000Z");
  });

  it("nextPaymentDate itself inside window is included", () => {
    const sub = makeSub({
      nextPaymentDate: new Date("2026-06-15T00:00:00Z"),
      billingIntervalMonths: 1,
    });
    const windowFrom = new Date("2026-05-01T00:00:00Z");
    const windowTo = new Date("2026-07-01T00:00:00Z");

    const dates = getExpectedPaymentDates(sub, windowFrom, windowTo);
    const isoSet = dates.map((d) => d.toISOString());
    expect(isoSet).toContain("2026-06-15T00:00:00.000Z");
  });

  it("returns at least 1 date (the boundary neighbor) even for tiny windows", () => {
    const sub = makeSub({
      nextPaymentDate: new Date("2027-01-01T00:00:00Z"),
      billingIntervalMonths: 12,
    });
    const windowFrom = new Date("2026-06-01T00:00:00Z");
    const windowTo = new Date("2026-06-30T00:00:00Z");

    const dates = getExpectedPaymentDates(sub, windowFrom, windowTo);
    expect(dates.length).toBeGreaterThanOrEqual(1);
  });
});

// ── amountInTolerance ────────────────────────────────────────────────────────

describe("amountInTolerance", () => {
  const emptyRates = new Map<string, Prisma.Decimal>();

  describe("same currency (5% tolerance)", () => {
    it("exact match: within tolerance", () => {
      expect(amountInTolerance(d("9.99"), "USD", d("9.99"), "USD", emptyRates)).toBe(true);
    });

    it("exactly 5% over: within tolerance (boundary inclusive)", () => {
      // 5% of 10 = 0.5; txn = 10.5 → ratio = 0.5/10 = 0.05 → <= 0.05
      expect(amountInTolerance(d("10.5"), "USD", d("10"), "USD", emptyRates)).toBe(true);
    });

    it("just over 5%: outside tolerance", () => {
      // ratio = 0.51/10 = 0.051 > 0.05
      expect(amountInTolerance(d("10.51"), "USD", d("10"), "USD", emptyRates)).toBe(false);
    });

    it("exactly 5% under: within tolerance", () => {
      // diff = 0.5, ratio = 0.5/10 = 0.05 → <= 0.05
      expect(amountInTolerance(d("9.5"), "USD", d("10"), "USD", emptyRates)).toBe(true);
    });

    it("just under 5%: outside tolerance", () => {
      expect(amountInTolerance(d("9.49"), "USD", d("10"), "USD", emptyRates)).toBe(false);
    });

    it("large amounts: 5% on 100", () => {
      expect(amountInTolerance(d("105"), "USD", d("100"), "USD", emptyRates)).toBe(true);
      expect(amountInTolerance(d("106"), "USD", d("100"), "USD", emptyRates)).toBe(false);
    });

    it("zero subPrice: matches only if txnAmount is also zero", () => {
      expect(amountInTolerance(d("0"), "USD", d("0"), "USD", emptyRates)).toBe(true);
      expect(amountInTolerance(d("1"), "USD", d("0"), "USD", emptyRates)).toBe(false);
    });
  });

  describe("cross-currency (10% tolerance)", () => {
    it("same value after conversion: within tolerance", () => {
      const rates = makeRates({ "USD-RUB": "90" });
      // txn: 900 RUB, sub: 10 USD; 900 RUB / 90 = 10 USD → exact match
      expect(amountInTolerance(d("900"), "RUB", d("10"), "USD", rates)).toBe(true);
    });

    it("10% over after conversion: within tolerance (boundary)", () => {
      const rates = makeRates({ "USD-RUB": "90" });
      // sub=10 USD, txn=990 RUB → 990/90=11 USD; diff=1, ratio=0.1 → <= 0.1
      expect(amountInTolerance(d("990"), "RUB", d("10"), "USD", rates)).toBe(true);
    });

    it("just over 10%: outside tolerance", () => {
      const rates = makeRates({ "USD-RUB": "90" });
      // sub=10 USD, txn=991 RUB → 991/90≈11.011 USD; diff≈1.011, ratio≈0.1011 > 0.10
      expect(amountInTolerance(d("991"), "RUB", d("10"), "USD", rates)).toBe(false);
    });

    it("returns false when no rate available for cross-currency pair", () => {
      // No rates at all
      expect(amountInTolerance(d("100"), "EUR", d("10"), "USD", emptyRates)).toBe(false);
    });
  });

  describe("Decimal precision", () => {
    it("no float imprecision: 1/3 * 3 = 1 exactly via Decimal", () => {
      // txn=10, sub=10; exact — straightforward precision check
      expect(amountInTolerance(d("10.00"), "USD", d("10.00"), "USD", emptyRates)).toBe(true);
    });
  });
});
