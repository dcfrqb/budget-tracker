import "server-only";

import { db } from "@/lib/db";
import { fetchCbrRates } from "./cbr-fetcher";
import { persistRates } from "./persist";

export type SyncFxResult = {
  /** Number of rate pairs passed to persistRates (see TODO below). */
  persistedCount: number;
  /** recordedAt of the latest USD-RUB row after persist, or null if not found. */
  latestRecordedAt: Date | null;
};

/**
 * Fetches CBR rates and persists them to the DB.
 * Throws on CBR failure — callers decide how to handle.
 *
 * TODO: persistRates has a 1h debounce and returns void; persistedCount reflects
 * the number of pairs *attempted*, not the number actually written to DB.
 */
export async function syncFxRates(): Promise<SyncFxResult> {
  const cbrRates = await fetchCbrRates();

  // Filter to currencies present in the Currency table — ExchangeRate has FK
  // on both fromCcy and toCcy, so any code CBR publishes that we don't track
  // (TJS, KGS, AMD, etc.) would violate the constraint.
  const knownCurrencies = await db.currency.findMany({ select: { code: true } });
  const knownSet = new Set(knownCurrencies.map((c) => c.code));

  const rubRates: Record<string, number> = {};
  for (const [code, entry] of Object.entries(cbrRates)) {
    if (knownSet.has(code) && knownSet.has("RUB")) {
      rubRates[code] = entry.rate;
    }
  }

  // Stablecoin peg: USDT/USDC ≈ 1 USD. CBR doesn't publish them, so we mirror
  // USD-RUB. Owner-approved peg — accepts <0.5% market deviation as noise.
  if (rubRates.USD !== undefined) {
    if (knownSet.has("USDT")) rubRates.USDT = rubRates.USD;
    if (knownSet.has("USDC")) rubRates.USDC = rubRates.USD;
  }

  await persistRates(rubRates);

  const persistedCount = Object.keys(rubRates).length;

  const latest = await db.exchangeRate.findFirst({
    where: { fromCcy: "USD", toCcy: "RUB" },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });

  return {
    persistedCount,
    latestRecordedAt: latest?.recordedAt ?? null,
  };
}
