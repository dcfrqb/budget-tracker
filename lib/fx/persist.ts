import "server-only";

import { db } from "@/lib/db";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Persists a set of FROM/RUB rates to ExchangeRate table.
 * Each key is a currency code (e.g. "USD"), value is the rate per 1 unit in RUB.
 *
 * Does NOT overwrite records — creates a new row per pair.
 * Skips pairs that already have a record within the last hour.
 * This builds up a history log for delta calculations.
 */
export async function persistRates(
  rates: Record<string, number>,
): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - ONE_HOUR_MS);

  // Get the most recent recordedAt for each pair in bulk
  const pairs = Object.keys(rates).map((code) => ({
    fromCcy: code,
    toCcy: "RUB",
  }));

  if (pairs.length === 0) return;

  // Load latest rows for all pairs at once
  const existing = await db.exchangeRate.findMany({
    where: {
      OR: pairs.map((p) => ({ fromCcy: p.fromCcy, toCcy: p.toCcy })),
      recordedAt: { gt: cutoff },
    },
    select: { fromCcy: true, toCcy: true },
  });

  const recentSet = new Set(existing.map((r) => `${r.fromCcy}-${r.toCcy}`));

  const toCreate = Object.entries(rates)
    .filter(([code]) => !recentSet.has(`${code}-RUB`))
    .map(([code, rate]) => ({
      fromCcy: code,
      toCcy: "RUB",
      rate: String(rate),
      recordedAt: now,
    }));

  if (toCreate.length === 0) return;

  await db.exchangeRate.createMany({ data: toCreate });
}
