import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeMyCost, estimateRecurringAmount } from "@/lib/subscription-share";

// Helper to build a Decimal
const d = (v: string | number) => new Prisma.Decimal(v);

// ── computeMyCost ────────────────────────────────────────────────────────────

describe("computeMyCost", () => {
  describe("PERSONAL mode", () => {
    it("returns full price", () => {
      const result = computeMyCost({
        price: d("15.99"),
        shareMode: "PERSONAL",
        shares: [],
      });
      expect(result.equals(d("15.99"))).toBe(true);
    });

    it("returns full price even with shares present", () => {
      const result = computeMyCost({
        price: d("9.99"),
        shareMode: "PERSONAL",
        shares: [{ amount: d("3.33") }, { amount: d("3.33") }],
      });
      expect(result.equals(d("9.99"))).toBe(true);
    });
  });

  describe("PAID_FOR_OTHERS mode", () => {
    it("returns full price", () => {
      const result = computeMyCost({
        price: d("29.99"),
        shareMode: "PAID_FOR_OTHERS",
        shares: [],
      });
      expect(result.equals(d("29.99"))).toBe(true);
    });
  });

  describe("SPLIT mode — all null (equal split)", () => {
    it("3 people null-shares: price / 3", () => {
      const result = computeMyCost({
        price: d("15"),
        shareMode: "SPLIT",
        totalUsers: 3,
        shares: [{ amount: null }, { amount: null }, { amount: null }],
      });
      expect(result.equals(d("5"))).toBe(true);
    });

    it("2 people null-shares: price / 2", () => {
      const result = computeMyCost({
        price: d("24"),
        shareMode: "SPLIT",
        totalUsers: 2,
        shares: [{ amount: null }, { amount: null }],
      });
      expect(result.equals(d("12"))).toBe(true);
    });

    it("1 person: returns full price (n <= 1 guard)", () => {
      const result = computeMyCost({
        price: d("10"),
        shareMode: "SPLIT",
        totalUsers: 1,
        shares: [{ amount: null }],
      });
      expect(result.equals(d("10"))).toBe(true);
    });
  });

  describe("SPLIT mode — explicit amounts", () => {
    it("all explicit: my cost = price - sum(others)", () => {
      // 3 people: two have fixed 5 each, I am the remainder
      const result = computeMyCost({
        price: d("18"),
        shareMode: "SPLIT",
        totalUsers: 3,
        shares: [{ amount: d("5") }, { amount: d("5") }, { amount: null }],
      });
      // implicit = 1, remainder = 18 - 10 = 8 → my share = 8/1 = 8
      expect(result.equals(d("8"))).toBe(true);
    });

    it("mixed: 2 explicit + 2 implicit: remainder split equally among implicit", () => {
      // price=40, totalUsers=4, 2 explicit at 8 each, 2 implicit (including me)
      const result = computeMyCost({
        price: d("40"),
        shareMode: "SPLIT",
        totalUsers: 4,
        shares: [
          { amount: d("8") },
          { amount: d("8") },
          { amount: null },
          { amount: null },
        ],
      });
      // remainder = 40 - 16 = 24; implicitSlots = 4 - 2 = 2; each gets 12
      expect(result.equals(d("12"))).toBe(true);
    });

    it("all explicit (no null): my share = price - sum(explicit)", () => {
      const result = computeMyCost({
        price: d("30"),
        shareMode: "SPLIT",
        totalUsers: 3,
        shares: [{ amount: d("10") }, { amount: d("10") }, { amount: d("10") }],
      });
      // All 3 explicit: remainder = 30 - 30 = 0
      expect(result.equals(d("0"))).toBe(true);
    });
  });

  describe("SPLIT mode — totalUsers fallback to shares.length", () => {
    it("null totalUsers uses shares.length", () => {
      const result = computeMyCost({
        price: d("30"),
        shareMode: "SPLIT",
        totalUsers: null,
        shares: [{ amount: null }, { amount: null }, { amount: null }],
      });
      // 3 shares, all null → 30/3 = 10
      expect(result.equals(d("10"))).toBe(true);
    });
  });

  describe("Decimal precision", () => {
    it("does not produce float imprecision (7.99 / 3 is a repeating decimal, Decimal handles it)", () => {
      const result = computeMyCost({
        price: d("7.99"),
        shareMode: "SPLIT",
        totalUsers: 3,
        shares: [{ amount: null }, { amount: null }, { amount: null }],
      });
      // 7.99 / 3 = 2.6633...
      // We assert it's between 2.66 and 2.67 without comparing to float
      expect(result.greaterThan(d("2.66"))).toBe(true);
      expect(result.lessThan(d("2.67"))).toBe(true);
    });
  });
});

// ── estimateRecurringAmount ──────────────────────────────────────────────────

describe("estimateRecurringAmount", () => {
  describe("fixed price", () => {
    it("returns price unchanged when isVariablePrice=false", () => {
      const result = estimateRecurringAmount({
        price: d("9.99"),
        isVariablePrice: false,
        recentCharges: [],
      });
      expect(result.equals(d("9.99"))).toBe(true);
    });

    it("ignores charges when isVariablePrice=false", () => {
      const result = estimateRecurringAmount({
        price: d("9.99"),
        isVariablePrice: false,
        recentCharges: [
          { amount: d("100"), currencyCode: "USD", occurredAt: new Date("2026-05-01") },
        ],
      });
      expect(result.equals(d("9.99"))).toBe(true);
    });
  });

  describe("variable price — no matching charges", () => {
    it("falls back to price when no charges", () => {
      const result = estimateRecurringAmount({
        price: d("15"),
        isVariablePrice: true,
        recentCharges: [],
        currency: "USD",
      });
      expect(result.equals(d("15"))).toBe(true);
    });

    it("falls back to price when charges have no occurredAt", () => {
      const result = estimateRecurringAmount({
        price: d("15"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("20"), currencyCode: "USD" }, // no occurredAt
        ],
        currency: "USD",
      });
      expect(result.equals(d("15"))).toBe(true);
    });

    it("falls back when currency doesn't match", () => {
      const result = estimateRecurringAmount({
        price: d("15"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("20"), currencyCode: "EUR", occurredAt: new Date("2026-05-01") },
        ],
        currency: "USD",
      });
      expect(result.equals(d("15"))).toBe(true);
    });
  });

  describe("variable price — averaging", () => {
    it("single month: returns that month sum", () => {
      const result = estimateRecurringAmount({
        price: d("0"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("30"), currencyCode: "USD", occurredAt: new Date("2026-05-05") },
          { amount: d("20"), currencyCode: "USD", occurredAt: new Date("2026-05-20") },
        ],
        currency: "USD",
      });
      // May sum = 50, avg of 1 month = 50
      expect(result.equals(d("50"))).toBe(true);
    });

    it("two months: averages both", () => {
      const result = estimateRecurringAmount({
        price: d("0"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("30"), currencyCode: "USD", occurredAt: new Date("2026-05-05") },
          { amount: d("40"), currencyCode: "USD", occurredAt: new Date("2026-06-05") },
        ],
        currency: "USD",
      });
      // May=30, Jun=40 → avg = 35
      expect(result.equals(d("35"))).toBe(true);
    });

    it("three months: averages all three (cap = 3 by default)", () => {
      const result = estimateRecurringAmount({
        price: d("0"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("10"), currencyCode: "USD", occurredAt: new Date("2026-04-10") },
          { amount: d("20"), currencyCode: "USD", occurredAt: new Date("2026-05-10") },
          { amount: d("30"), currencyCode: "USD", occurredAt: new Date("2026-06-10") },
        ],
        currency: "USD",
      });
      // Apr=10, May=20, Jun=30 → avg = 20
      expect(result.equals(d("20"))).toBe(true);
    });

    it("four months but cap=3: uses only the 3 most recent", () => {
      const result = estimateRecurringAmount({
        price: d("0"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("100"), currencyCode: "USD", occurredAt: new Date("2026-03-10") },
          { amount: d("10"), currencyCode: "USD", occurredAt: new Date("2026-04-10") },
          { amount: d("20"), currencyCode: "USD", occurredAt: new Date("2026-05-10") },
          { amount: d("30"), currencyCode: "USD", occurredAt: new Date("2026-06-10") },
        ],
        currency: "USD",
      });
      // Most recent 3: Jun=30, May=20, Apr=10 → avg = 20 (March excluded)
      expect(result.equals(d("20"))).toBe(true);
    });

    it("custom n cap: n=2 uses only 2 most recent months", () => {
      const result = estimateRecurringAmount({
        price: d("0"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("100"), currencyCode: "USD", occurredAt: new Date("2026-04-10") },
          { amount: d("10"), currencyCode: "USD", occurredAt: new Date("2026-05-10") },
          { amount: d("30"), currencyCode: "USD", occurredAt: new Date("2026-06-10") },
        ],
        currency: "USD",
        n: 2,
      });
      // 2 most recent: Jun=30, May=10 → avg = 20
      expect(result.equals(d("20"))).toBe(true);
    });

    it("multiple charges same month sum correctly", () => {
      const result = estimateRecurringAmount({
        price: d("0"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("5"), currencyCode: "USD", occurredAt: new Date("2026-06-01") },
          { amount: d("7"), currencyCode: "USD", occurredAt: new Date("2026-06-15") },
          { amount: d("3"), currencyCode: "USD", occurredAt: new Date("2026-06-28") },
        ],
        currency: "USD",
      });
      // All June: sum=15, avg=15
      expect(result.equals(d("15"))).toBe(true);
    });

    it("Decimal assertion: result is a Prisma.Decimal (not JS number)", () => {
      const result = estimateRecurringAmount({
        price: d("9.99"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("8.50"), currencyCode: "USD", occurredAt: new Date("2026-06-01") },
        ],
        currency: "USD",
      });
      expect(result instanceof Prisma.Decimal).toBe(true);
      // avg = 8.50
      expect(result.equals(d("8.50"))).toBe(true);
    });

    it("ignores charges without currency filter when no currency specified", () => {
      const result = estimateRecurringAmount({
        price: d("0"),
        isVariablePrice: true,
        recentCharges: [
          { amount: d("20"), currencyCode: "EUR", occurredAt: new Date("2026-06-01") },
          { amount: d("30"), currencyCode: "USD", occurredAt: new Date("2026-06-05") },
        ],
        // no currency filter → all are included
      });
      // Both included: Jun = 20+30 = 50, avg = 50
      expect(result.equals(d("50"))).toBe(true);
    });
  });
});
