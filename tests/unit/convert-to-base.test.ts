import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { convertToBase } from "@/lib/data/wallet";

const d = (v: string | number) => new Prisma.Decimal(v);

function makeRates(pairs: Record<string, string>): Map<string, Prisma.Decimal> {
  const map = new Map<string, Prisma.Decimal>();
  for (const [key, val] of Object.entries(pairs)) {
    map.set(key, d(val));
  }
  return map;
}

describe("convertToBase", () => {
  describe("same-currency passthrough", () => {
    it("returns the amount unchanged when fromCcy === baseCcy", () => {
      const rates = makeRates({});
      const result = convertToBase(d("100"), "RUB", "RUB", rates);
      expect(result).not.toBeNull();
      expect(result!.equals(d("100"))).toBe(true);
    });

    it("works with string amount input", () => {
      const result = convertToBase("250.50", "USD", "USD", makeRates({}));
      expect(result!.equals(d("250.50"))).toBe(true);
    });

    it("works with number amount input", () => {
      const result = convertToBase(100, "EUR", "EUR", makeRates({}));
      expect(result!.equals(d("100"))).toBe(true);
    });
  });

  describe("direct rate", () => {
    it("converts using direct rate USD→RUB", () => {
      const rates = makeRates({ "USD-RUB": "90" });
      const result = convertToBase(d("10"), "USD", "RUB", rates);
      expect(result).not.toBeNull();
      expect(result!.equals(d("900"))).toBe(true);
    });

    it("fractional amount", () => {
      const rates = makeRates({ "EUR-RUB": "100" });
      const result = convertToBase(d("1.5"), "EUR", "RUB", rates);
      expect(result!.equals(d("150"))).toBe(true);
    });
  });

  describe("inverse rate", () => {
    it("converts RUB→USD when only USD-RUB is stored (inverse path)", () => {
      // Only USD-RUB=90 exists; to convert RUB→USD, use 1/90
      const rates = makeRates({ "USD-RUB": "90" });
      const result = convertToBase(d("90"), "RUB", "USD", rates);
      expect(result).not.toBeNull();
      expect(result!.equals(d("1"))).toBe(true);
    });

    it("returns null when inverse rate is zero (avoid division by zero)", () => {
      const rates = makeRates({ "RUB-USD": "0" });
      const result = convertToBase(d("100"), "USD", "RUB", rates);
      // direct USD-RUB not in map; inverse is 0 → skip; no pivot → null
      expect(result).toBeNull();
    });
  });

  describe("pivot via USD", () => {
    it("converts EUR→RUB via USD pivot when EUR-USD and USD-RUB are available", () => {
      const rates = makeRates({
        "EUR-USD": "1.1",
        "USD-RUB": "90",
      });
      const result = convertToBase(d("1"), "EUR", "RUB", rates);
      expect(result).not.toBeNull();
      // 1 EUR * 1.1 USD/EUR * 90 RUB/USD = 99 RUB
      expect(result!.equals(d("99"))).toBe(true);
    });

    it("converts BTC→RUB via USD pivot (BTC-USD + USD-RUB)", () => {
      const rates = makeRates({
        "BTC-USD": "60000",
        "USD-RUB": "90",
      });
      const result = convertToBase(d("0.5"), "BTC", "RUB", rates);
      expect(result).not.toBeNull();
      // 0.5 BTC * 60000 * 90 = 2700000
      expect(result!.equals(d("2700000"))).toBe(true);
    });

    it("uses inverse for pivot side: USD-EUR→RUB when only EUR-USD stored", () => {
      // EUR-USD=1.1 means USD=1/1.1 EUR; converting EUR→RUB via USD:
      // EUR→USD: direct EUR-USD=1.1 exists; USD→RUB direct exists
      const rates = makeRates({
        "EUR-USD": "1.1",
        "USD-RUB": "90",
      });
      // Confirmed: should use EUR-USD direct × USD-RUB
      const result = convertToBase(d("2"), "EUR", "RUB", rates);
      expect(result!.equals(d("198"))).toBe(true);
    });
  });

  describe("missing rate", () => {
    it("returns null when no rate exists for the pair and no pivot path", () => {
      const rates = makeRates({ "USD-RUB": "90" }); // no EUR data
      const result = convertToBase(d("100"), "EUR", "GBP", rates);
      expect(result).toBeNull();
    });

    it("returns null when rates map is empty and currencies differ", () => {
      const rates = new Map<string, Prisma.Decimal>();
      const result = convertToBase(d("100"), "USD", "RUB", rates);
      expect(result).toBeNull();
    });
  });

  describe("Decimal precision", () => {
    it("result is a Prisma.Decimal instance", () => {
      const rates = makeRates({ "USD-RUB": "90" });
      const result = convertToBase(d("1"), "USD", "RUB", rates);
      expect(result instanceof Prisma.Decimal).toBe(true);
    });

    it("zero amount → zero result", () => {
      const rates = makeRates({ "USD-RUB": "90" });
      const result = convertToBase(d("0"), "USD", "RUB", rates);
      expect(result!.equals(d("0"))).toBe(true);
    });
  });
});
