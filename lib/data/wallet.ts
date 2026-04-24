import { Prisma } from "@prisma/client";
import type { Account, Currency, ExchangeRate, Institution } from "@prisma/client";
import { db } from "@/lib/db";

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

// FX-строки для rates-row: последний rate + delta24h на каждую пару.
export async function getFxRates(): Promise<FxRateRow[]> {
  const rows = await db.exchangeRate.findMany({ orderBy: { recordedAt: "desc" } });
  const DAY_MS = 24 * 60 * 60 * 1000;
  const byPair = new Map<string, ExchangeRate[]>();
  for (const r of rows) {
    const key = `${r.fromCcy}-${r.toCcy}`;
    const list = byPair.get(key);
    if (list) list.push(r);
    else byPair.set(key, [r]);
  }
  return [...byPair.values()].map((list) => {
    const latest = list[0];
    const cutoff = new Date(latest.recordedAt.getTime() - DAY_MS);
    const prev = list.find((r) => r.recordedAt <= cutoff);
    let delta24hPct: Prisma.Decimal | null = null;
    if (prev) {
      const prevRate = new Prisma.Decimal(prev.rate);
      const latestRate = new Prisma.Decimal(latest.rate);
      if (!prevRate.isZero()) {
        delta24hPct = latestRate.minus(prevRate).div(prevRate).times(100);
      }
    }
    return { ...latest, delta24hPct };
  });
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
// Если rate'а нет — счёт скипается + лог в консоль (на MVP достаточно).
export async function getWalletTotals(
  userId: string,
  baseCcy: string,
): Promise<WalletTotals> {
  const [accounts, rates] = await Promise.all([
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false },
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
