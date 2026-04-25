import { Prisma } from "@prisma/client";
import type { Account, Currency, ExchangeRate, Institution } from "@prisma/client";
import { db } from "@/lib/db";
import { fetchCbrRates, resolvePairRate } from "@/lib/fx/cbr-fetcher";
import { persistRates } from "@/lib/fx/persist";

export type AccountWithCurrency = Account & { currency: Currency };
export type InstitutionWithAccounts = Institution & { accounts: AccountWithCurrency[] };
export type FxRateRow = ExchangeRate & { delta24hPct: Prisma.Decimal | null };

// Институции с non-архивными счетами, отсортировано по sortOrder.
// CASH-институция исключена — cash рендерится отдельной секцией.
export async function getInstitutionsWithAccounts(
  userId: string,
): Promise<InstitutionWithAccounts[]> {
  return db.institution.findMany({
    where: { userId, kind: { not: "CASH" } },
    orderBy: { sortOrder: "asc" },
    include: {
      accounts: {
        where: { deletedAt: null, isArchived: false },
        orderBy: { sortOrder: "asc" },
        include: { currency: true },
      },
    },
  });
}

// Все CASH-счета, non-архивные. Живут отдельной секцией.
export async function getCashStash(userId: string): Promise<AccountWithCurrency[]> {
  return db.account.findMany({
    where: {
      userId,
      kind: "CASH",
      deletedAt: null,
      isArchived: false,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { currency: true },
  });
}

// Архив (все kind'ы).
export async function getArchivedAccounts(
  userId: string,
): Promise<AccountWithCurrency[]> {
  return db.account.findMany({
    where: { userId, deletedAt: null, isArchived: true },
    orderBy: { archivedAt: "desc" },
    include: { currency: true },
  });
}

// Последние rate'ы по всем парам. Ключ map'ы "FROM-TO".
export async function getLatestRatesMap(): Promise<Map<string, Prisma.Decimal>> {
  // В seed — по одной записи на пару. При истории — нужно DISTINCT ON.
  const rows = await db.exchangeRate.findMany({ orderBy: { recordedAt: "desc" } });
  const map = new Map<string, Prisma.Decimal>();
  for (const r of rows) {
    const key = `${r.fromCcy}-${r.toCcy}`;
    if (!map.has(key)) map.set(key, new Prisma.Decimal(r.rate));
  }
  return map;
}

// Конвертация через direct / inverse / pivot (USD).
// Возвращает null если rate'а нет ни напрямую, ни через USD.
export function convertToBase(
  amount: Prisma.Decimal | string | number,
  fromCcy: string,
  baseCcy: string,
  rates: Map<string, Prisma.Decimal>,
): Prisma.Decimal | null {
  const value = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
  if (fromCcy === baseCcy) return value;

  const direct = rates.get(`${fromCcy}-${baseCcy}`);
  if (direct) return value.times(direct);

  const inverse = rates.get(`${baseCcy}-${fromCcy}`);
  if (inverse && !inverse.isZero()) return value.div(inverse);

  // Через USD как pivot (покрывает BTC→RUB: BTC-USD * USD-RUB).
  const PIVOT = "USD";
  if (fromCcy !== PIVOT && baseCcy !== PIVOT) {
    const a = rates.get(`${fromCcy}-${PIVOT}`) ?? (() => {
      const inv = rates.get(`${PIVOT}-${fromCcy}`);
      return inv && !inv.isZero() ? new Prisma.Decimal(1).div(inv) : null;
    })();
    const b = rates.get(`${PIVOT}-${baseCcy}`) ?? (() => {
      const inv = rates.get(`${baseCcy}-${PIVOT}`);
      return inv && !inv.isZero() ? new Prisma.Decimal(1).div(inv) : null;
    })();
    if (a && b) return value.times(a).times(b);
  }

  return null;
}

// Default FX pairs shown when BudgetSettings.shownFxPairs is empty.
export const DEFAULT_FX_PAIRS = ["USD/RUB", "EUR/RUB"] as const;

// FX-строки для rates-row.
// shownFxPairs — из BudgetSettings.shownFxPairs (пустой массив = дефолт).
// Стратегия: CBR-fetch → persist → delta из истории БД.
// При ошибке CBR — fallback на последние записи в ExchangeRate.
export async function getFxRates(shownFxPairs: string[] = []): Promise<FxRateRow[]> {
  const targetPairs = shownFxPairs.length > 0 ? shownFxPairs : [...DEFAULT_FX_PAIRS];

  // --- Step 1: try CBR fetch ---
  let cbrRates: Awaited<ReturnType<typeof fetchCbrRates>> | null = null;
  try {
    cbrRates = await fetchCbrRates();
    // Persist all CBR rates (FROM/RUB) for history and fallback.
    // Fire-and-forget: don't block rendering on persist errors.
    const rubRates: Record<string, number> = {};
    for (const [code, entry] of Object.entries(cbrRates)) {
      rubRates[code] = entry.rate;
    }
    persistRates(rubRates).catch((e) =>
      console.warn("[getFxRates] persist failed:", e),
    );
  } catch (e) {
    console.warn("[getFxRates] CBR fetch failed, using DB fallback:", e);
  }

  // --- Step 2: load DB history for delta calculation ---
  // Load all rows for the target pairs to compute delta24h.
  const pairFilters = targetPairs.map((p) => {
    const [from, to] = p.split("/");
    return { fromCcy: from, toCcy: to };
  });

  const dbRows = await db.exchangeRate.findMany({
    where: pairFilters.length > 0 ? { OR: pairFilters } : undefined,
    orderBy: { recordedAt: "desc" },
  });

  const DAY_MS = 24 * 60 * 60 * 1000;
  // Group DB rows by pair key
  const byPair = new Map<string, ExchangeRate[]>();
  for (const r of dbRows) {
    const key = `${r.fromCcy}-${r.toCcy}`;
    const list = byPair.get(key);
    if (list) list.push(r);
    else byPair.set(key, [r]);
  }

  const now = new Date();
  const result: FxRateRow[] = [];

  for (const pairStr of targetPairs) {
    const [from, to] = pairStr.split("/");
    const key = `${from}-${to}`;

    // Resolve current rate from CBR or DB
    let currentRate: Prisma.Decimal | null = null;
    if (cbrRates) {
      const resolved = resolvePairRate(from, to, cbrRates);
      if (resolved !== null) {
        currentRate = new Prisma.Decimal(resolved.toFixed(10));
      }
    }

    const history = byPair.get(key) ?? [];
    // If CBR didn't give us a rate, use latest DB row
    if (currentRate === null && history.length > 0) {
      currentRate = new Prisma.Decimal(history[0].rate);
    }

    if (currentRate === null) {
      // No rate available at all — skip pair (UI will show "—")
      continue;
    }

    // Build a synthetic ExchangeRate row for the current rate
    const syntheticRow: ExchangeRate = {
      id: key,
      fromCcy: from,
      toCcy: to,
      rate: currentRate,
      recordedAt: now,
    };

    // Delta: compare current against a row from ~24h ago in DB history
    const cutoff = new Date(now.getTime() - DAY_MS);
    const prev = history.find((r) => r.recordedAt <= cutoff);
    let delta24hPct: Prisma.Decimal | null = null;
    if (prev) {
      const prevRate = new Prisma.Decimal(prev.rate);
      if (!prevRate.isZero()) {
        delta24hPct = currentRate.minus(prevRate).div(prevRate).times(100);
      }
    }

    result.push({ ...syntheticRow, delta24hPct });
  }

  return result;
}

// Aggregate totals in base currency. LOAN accounts are excluded from all aggregates
// (they represent liabilities, not assets). LOAN accounts remain visible on /wallet
// in their institution section but do not contribute to any monetary total.
export type WalletTotals = {
  net: { valueBase: Prisma.Decimal; accountsCount: number };
  liquid: { valueBase: Prisma.Decimal; accountsCount: number };
  savings: { valueBase: Prisma.Decimal; accountsCount: number };
  cash: { valueBase: Prisma.Decimal; accountsCount: number };
};

// 4 агрегата. Архивные не учитываются. LOAN-счёт исключён из net и sub-агрегатов.
// Счета с includeInAnalytics=false исключены из всех агрегатов.
// Если rate'а нет — счёт скипается + лог в консоль (на MVP достаточно).
export async function getWalletTotals(
  userId: string,
  baseCcy: string,
): Promise<WalletTotals> {
  const [accounts, rates] = await Promise.all([
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false, includeInAnalytics: true },
      select: { id: true, kind: true, currencyCode: true, balance: true },
    }),
    getLatestRatesMap(),
  ]);

  const zero = new Prisma.Decimal(0);
  const totals: WalletTotals = {
    net: { valueBase: zero, accountsCount: 0 },
    liquid: { valueBase: zero, accountsCount: 0 },
    savings: { valueBase: zero, accountsCount: 0 },
    cash: { valueBase: zero, accountsCount: 0 },
  };

  for (const a of accounts) {
    // LOAN accounts represent liabilities — excluded from all money aggregates.
    if (a.kind === "LOAN") continue;

    const inBase = convertToBase(a.balance, a.currencyCode, baseCcy, rates);
    if (!inBase) {
      console.warn(
        `[wallet] skip acc ${a.id}: no rate ${a.currencyCode}→${baseCcy}`,
      );
      continue;
    }

    // CREDIT accounts: balance = current debt (positive number = money owed).
    // Subtract from net as a liability; do NOT include in liquid bucket.
    if (a.kind === "CREDIT") {
      totals.net.valueBase = totals.net.valueBase.minus(inBase);
      totals.net.accountsCount += 1;
      continue;
    }

    totals.net.valueBase = totals.net.valueBase.plus(inBase);
    totals.net.accountsCount += 1;
    if (a.kind === "CARD" || a.kind === "CRYPTO") {
      totals.liquid.valueBase = totals.liquid.valueBase.plus(inBase);
      totals.liquid.accountsCount += 1;
    } else if (a.kind === "SAVINGS") {
      totals.savings.valueBase = totals.savings.valueBase.plus(inBase);
      totals.savings.accountsCount += 1;
    } else if (a.kind === "CASH") {
      totals.cash.valueBase = totals.cash.valueBase.plus(inBase);
      totals.cash.accountsCount += 1;
    }
  }

  return totals;
}
