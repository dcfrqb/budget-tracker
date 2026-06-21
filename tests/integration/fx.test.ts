/**
 * integration/fx.test.ts
 *
 * Tests for getLatestRatesMap (lib/data/wallet.ts) and convertToBase.
 * Verifies:
 *  1. getLatestRatesMap returns the LATEST rate per pair when multiple rows exist.
 *  2. convertToBase composes correctly with the DB-loaded map (USD→RUB=100).
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { makeExchangeRate } from "@/tests/fixtures/builders";

// Rates seeded by factory.ts (used as baseline):
//   USD→RUB = 100, EUR→RUB = 110, GEL→RUB = 3.4
//   USDT→USD = 1, BTC→USD = 42500
//   RUB→USD = 0.01, RUB→EUR = ~1/110
// All seeded at "now" with a single recordedAt.

describe("getLatestRatesMap", () => {
  it("returns baseline seeded rates (USD-RUB = 100)", async () => {
    const map = await getLatestRatesMap();
    const rate = map.get("USD-RUB");
    expect(rate).toBeDefined();
    expect(rate!.equals(new Prisma.Decimal("100"))).toBe(true);
  });

  it("returns only the LATEST rate when multiple rows exist for the same pair", async () => {
    // Insert an older rate at T-1h
    const oldTime = new Date(Date.now() - 3600_000);
    await makeExchangeRate(db, {
      fromCcy: "USD",
      toCcy: "RUB",
      rate: "95", // old stale value
      recordedAt: oldTime,
    });

    // Insert a newer rate at T+1 (future to ensure it wins)
    const newTime = new Date(Date.now() + 60_000);
    await makeExchangeRate(db, {
      fromCcy: "USD",
      toCcy: "RUB",
      rate: "105", // latest value
      recordedAt: newTime,
    });

    const map = await getLatestRatesMap();
    const rate = map.get("USD-RUB");
    expect(rate).toBeDefined();
    // Should return 105, not 95 or the seed 100
    expect(rate!.equals(new Prisma.Decimal("105"))).toBe(true);
  });

  it("includes GEL-RUB (3.4) from seed", async () => {
    const map = await getLatestRatesMap();
    const rate = map.get("GEL-RUB");
    expect(rate).toBeDefined();
    expect(rate!.equals(new Prisma.Decimal("3.4"))).toBe(true);
  });

  it("includes BTC-USD (42500) from seed", async () => {
    const map = await getLatestRatesMap();
    const rate = map.get("BTC-USD");
    expect(rate).toBeDefined();
    expect(rate!.equals(new Prisma.Decimal("42500"))).toBe(true);
  });
});

describe("convertToBase via real rates map", () => {
  it("same currency returns identity", async () => {
    const map = await getLatestRatesMap();
    const result = convertToBase(new Prisma.Decimal("500"), "RUB", "RUB", map);
    expect(result).not.toBeNull();
    expect(result!.equals(new Prisma.Decimal("500"))).toBe(true);
  });

  it("USD → RUB uses direct rate (1 USD = 100 RUB)", async () => {
    const map = await getLatestRatesMap();
    // 5 USD * 100 = 500 RUB
    const result = convertToBase(new Prisma.Decimal("5"), "USD", "RUB", map);
    expect(result).not.toBeNull();
    expect(result!.equals(new Prisma.Decimal("500"))).toBe(true);
  });

  it("EUR → RUB uses direct rate (1 EUR = 110 RUB)", async () => {
    const map = await getLatestRatesMap();
    // 2 EUR * 110 = 220 RUB
    const result = convertToBase(new Prisma.Decimal("2"), "EUR", "RUB", map);
    expect(result).not.toBeNull();
    expect(result!.equals(new Prisma.Decimal("220"))).toBe(true);
  });

  it("GEL → RUB uses direct rate (1 GEL = 3.4 RUB)", async () => {
    const map = await getLatestRatesMap();
    // 10 GEL * 3.4 = 34 RUB
    const result = convertToBase(new Prisma.Decimal("10"), "GEL", "RUB", map);
    expect(result).not.toBeNull();
    expect(result!.equals(new Prisma.Decimal("34"))).toBe(true);
  });

  it("BTC → RUB via USD pivot (1 BTC = 42500 USD = 4250000 RUB)", async () => {
    const map = await getLatestRatesMap();
    // BTC→USD = 42500, USD→RUB = 100 → 1 BTC * 42500 * 100 = 4250000 RUB
    const result = convertToBase(new Prisma.Decimal("1"), "BTC", "RUB", map);
    expect(result).not.toBeNull();
    expect(result!.equals(new Prisma.Decimal("4250000"))).toBe(true);
  });

  it("returns null for unknown pair without pivot path", async () => {
    const emptyMap = new Map<string, Prisma.Decimal>();
    const result = convertToBase(new Prisma.Decimal("100"), "UNKNOWN", "RUB", emptyMap);
    expect(result).toBeNull();
  });
});
