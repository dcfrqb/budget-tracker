import "server-only";

// CBR daily rates JSON mirror — https://www.cbr-xml-daily.ru/daily_json.js
// All pairs are FROM → RUB (as published by the CBR).
// ISR: 1-hour revalidation via Next.js fetch cache.

const CBR_URL = "https://www.cbr-xml-daily.ru/daily_json.js";

export type CbrRateEntry = {
  rate: number;   // Value / Nominal — rate per 1 unit of foreign currency in RUB
  nominal: number; // 1 in most cases, 100 for JPY, etc.
};

export type CbrRates = Record<string, CbrRateEntry>;

interface CbrValute {
  CharCode: string;
  Nominal: number;
  Value: number;
  Name: string;
}

interface CbrResponse {
  Date: string;
  Valute: Record<string, CbrValute>;
}

/**
 * Fetches today's CBR rates.
 * Returns a map: { "USD": { rate: 89.25, nominal: 1 }, "EUR": { rate: 97.10, nominal: 1 }, ... }
 * All rates are in RUB per 1 unit (after dividing by Nominal).
 * Revalidated once per hour via Next.js ISR cache.
 */
export async function fetchCbrRates(): Promise<CbrRates> {
  const res = await fetch(CBR_URL, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(
      `[cbr-fetcher] CBR request failed: ${res.status} ${res.statusText}`,
    );
  }

  let json: CbrResponse;
  try {
    json = (await res.json()) as CbrResponse;
  } catch {
    throw new Error("[cbr-fetcher] CBR response is not valid JSON");
  }

  if (!json.Valute || typeof json.Valute !== "object") {
    throw new Error("[cbr-fetcher] CBR response missing Valute field");
  }

  const result: CbrRates = {};
  for (const entry of Object.values(json.Valute)) {
    if (!entry.CharCode || !entry.Nominal || !entry.Value) continue;
    result[entry.CharCode] = {
      rate: entry.Value / entry.Nominal,
      nominal: 1,
    };
  }

  return result;
}

/**
 * Resolves a pair rate from CBR data.
 * Supports:
 *   FROM/RUB  → direct lookup
 *   RUB/FROM  → inverse
 *   FROM/TO   → cross via RUB
 * Returns null if cannot resolve.
 */
export function resolvePairRate(
  from: string,
  to: string,
  cbrRates: CbrRates,
): number | null {
  if (from === to) return 1;

  if (to === "RUB") {
    return cbrRates[from]?.rate ?? null;
  }

  if (from === "RUB") {
    const toRate = cbrRates[to]?.rate;
    if (!toRate || toRate === 0) return null;
    return 1 / toRate;
  }

  // Cross via RUB
  const fromRub = cbrRates[from]?.rate;
  const toRub = cbrRates[to]?.rate;
  if (!fromRub || !toRub || toRub === 0) return null;
  return fromRub / toRub;
}

/**
 * Returns the set of currency codes available from CBR.
 * Useful for disabling non-CBR currencies in the add-pair dialog.
 */
export function getCbrAvailableCodes(cbrRates: CbrRates): Set<string> {
  const codes = new Set(Object.keys(cbrRates));
  codes.add("RUB"); // RUB is always available as target
  return codes;
}
