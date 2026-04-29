import type { BankAdapter, AdapterContext } from "@/lib/integrations/types";
import type { ImportRow } from "@/lib/import/types";
import { listCardTransactions } from "@/lib/integrations/bybit/card-records";
import { fetchCardSpendingPower } from "@/lib/integrations/bybit/balance";
import { BybitApiError } from "@/lib/integrations/bybit/types";

const log = (msg: string) => console.log(`[bybit-card] ${msg}`);

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

type BybitSecrets = {
  apiKey: string;
  apiSecret: string;
};

function readSecrets(ctx: AdapterContext): BybitSecrets {
  const s = ctx.secrets as Record<string, unknown>;
  return {
    apiKey: typeof s.apiKey === "string" ? s.apiKey : "",
    apiSecret: typeof s.apiSecret === "string" ? s.apiSecret : "",
  };
}

function classifyBybitError(err: unknown): string {
  if (err instanceof BybitApiError) return `bybit:${err.class}`;
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") return "fetch_timeout";
    if (err.message.includes("net::ERR_") || err.message.includes("NetworkError")) return "network_error";
  }
  return "unknown";
}

function composeNote(opts: {
  city: string;
  country: string;
  points: number;
}): string | undefined {
  const location = [opts.city, opts.country].filter(Boolean).join(", ");
  const pointsStr = opts.points > 0 ? `+${opts.points} pts` : "";
  const parts = [location, pointsStr].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export const bybitCardAdapter: BankAdapter = {
  id: "bybit-card",
  displayName: "settings.integrations.bybit_card.title",
  category: "api-reverse",
  supports: {
    login: true,
    otp: false,
    fetchTransactions: true,
    parseFile: false,
    listExternalAccounts: true,
  },

  async login(
    ctx: AdapterContext,
    input: { username: string; password: string },
  ) {
    const apiKey = input.username.trim();
    const apiSecret = input.password.trim();

    if (!apiKey || !apiSecret) {
      await ctx.setStatus("ERROR", "missing_credentials");
      return { ok: false as const, error: "missing_credentials" };
    }

    const now = Date.now();
    const probeFrom = now - 7 * 24 * 60 * 60 * 1000;

    log(`login: probe connection apiKey=${apiKey.slice(0, 6)}…`);
    try {
      await listCardTransactions({
        apiKey,
        apiSecret,
        startTime: probeFrom,
        endTime: now,
        pageSize: 1,
        maxPages: 1,
      });
    } catch (err) {
      const errClass = classifyBybitError(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`login: probe failed class=${errClass} msg=${errMsg}`);
      await ctx.setStatus("ERROR", errClass);
      return { ok: false as const, error: errClass };
    }

    await ctx.saveSecrets({ apiKey, apiSecret } satisfies BybitSecrets);
    await ctx.setStatus("CONNECTED");
    log(`login: success`);
    return { ok: true as const };
  },

  async listExternalAccounts(ctx: AdapterContext) {
    const { apiKey, apiSecret } = readSecrets(ctx);

    if (!apiKey || !apiSecret) {
      await ctx.setStatus("ERROR", "missing_credentials");
      throw new Error("missing_credentials");
    }

    const now = Date.now();
    const from = now - NINETY_DAYS_MS;
    log(`listExternalAccounts: fetching 90-day window`);

    let result: Awaited<ReturnType<typeof listCardTransactions>>;
    try {
      result = await listCardTransactions({
        apiKey,
        apiSecret,
        startTime: from,
        endTime: now,
        pageSize: 50,
        maxPages: 50,
      });
    } catch (err) {
      const errClass = classifyBybitError(err);
      log(`listExternalAccounts: fetch failed class=${errClass}`);
      await ctx.setStatus("ERROR", errClass);
      throw err;
    }

    if (result.rows.length === 0) {
      log(`listExternalAccounts: no transactions in 90d — returning empty`);
      return [];
    }

    // Group by pan4; use basicCurrency per card (always USD for Bybit Card)
    const firstCurrencyByPan4 = new Map<string, string>();
    for (const row of result.rows) {
      if (!firstCurrencyByPan4.has(row.pan4)) {
        firstCurrencyByPan4.set(row.pan4, row.basicCurrency || "USD");
      }
    }

    const externals = Array.from(firstCurrencyByPan4.entries()).map(
      ([pan4, currencyCode]) => ({
        externalAccountId: pan4,
        label: `Bybit Card •••${pan4}`,
        currencyCode,
        accountType: "bybit-card",
        cardLast4: [pan4],
        balance: undefined,
      }),
    );

    log(`listExternalAccounts: found ${externals.length} card(s)`);
    return externals;
  },

  async runSync(
    ctx: AdapterContext,
    range: { from: Date; to: Date },
  ) {
    const { apiKey, apiSecret } = readSecrets(ctx);

    if (!apiKey || !apiSecret) {
      await ctx.setStatus("ERROR", "missing_credentials");
      throw new Error("missing_credentials");
    }

    const to = range.to;
    const from = range.from;

    log(`runSync: window from=${from.toISOString()} to=${to.toISOString()}`);

    let result: Awaited<ReturnType<typeof listCardTransactions>>;
    try {
      result = await listCardTransactions({
        apiKey,
        apiSecret,
        startTime: from.getTime(),
        endTime: to.getTime(),
        pageSize: 50,
        maxPages: 50,
      });
    } catch (err) {
      const errClass = classifyBybitError(err);
      log(`runSync: fetch failed class=${errClass}`);
      await ctx.setStatus("ERROR", errClass);
      throw err;
    }

    if (result.truncated) {
      log(`runSync: WARNING — response truncated, some transactions may be missing`);
    }

    const rowsFiltered = result.rawCount - result.rows.length;
    if (rowsFiltered > 0) {
      log(`runSync: filtered out ${rowsFiltered} non-spend rows (rawCount=${result.rawCount})`);
    }

    const rows: ImportRow[] = [];
    const firstCurrencyByPan4 = new Map<string, string>();
    const cardLast4ByExternal = new Map<string, string[]>();

    for (const record of result.rows) {
      // Track first-seen currency per card (USD for Bybit Card)
      if (!firstCurrencyByPan4.has(record.pan4)) {
        firstCurrencyByPan4.set(record.pan4, record.basicCurrency || "USD");
      }

      // Track card last-4 per external account id
      if (!cardLast4ByExternal.has(record.pan4)) {
        cardLast4ByExternal.set(record.pan4, []);
      }
      const pan4List = cardLast4ByExternal.get(record.pan4)!;
      if (!pan4List.includes(record.pan4)) {
        pan4List.push(record.pan4);
      }

      const occurredAt = new Date(Number(record.transactionDate)).toISOString();

      const note = composeNote({
        city: record.merchCity,
        country: record.merchCountry,
        points: record.point,
      });

      const description = record.merchName || record.merchCategoryDesc || "Bybit Card";

      const row: ImportRow = {
        externalId: record.transactionId,
        occurredAt,
        amount: record.transactionAmount,
        currencyCode: record.basicCurrency || "USD",
        kind: "EXPENSE",
        direction: "out",
        description,
        cardLast4: record.pan4,
        source: "bybit-card",
        note,
        raw: {
          transactionId: record.transactionId,
          outOrderId: record.outOrderId,
          bizId: record.bizId,
          point: String(record.point),
        },
      };

      rows.push(row);
    }

    log(`runSync: total ImportRows=${rows.length} from ${result.rawCount} raw records`);

    // Card balance source: Earn-only.
    //
    // Bybit Card spends from FUND, but Auto-Earn auto-redeems Earn→FUND on
    // payment. So the Earn balance is the truthful "money available on this
    // card". UTA equity (BTC/ETH dust in trading positions) and FUND dust are
    // unrelated to the card and would inflate the number for users with
    // active trading or pending withdrawals.
    let cardBalanceUsd: string | undefined;
    try {
      const balanceResult = await fetchCardSpendingPower({ apiKey, apiSecret });

      if (balanceResult.sources.earn.ok) {
        cardBalanceUsd = balanceResult.sources.earn.usd;
        log(`runSync: card balance from Earn=${cardBalanceUsd} (UTA/FUND ignored — unrelated to card)`);
      } else {
        log(`runSync: Earn balance unavailable: ${balanceResult.sources.earn.reason}`);
      }

      if (balanceResult.skippedCoins.length > 0) {
        log(`runSync: non-stablecoin Earn positions skipped: ${balanceResult.skippedCoins.join(", ")}`);
      }
    } catch (err) {
      log(`runSync: balance fetch failed class=${classifyBybitError(err)}`);
    }

    const externals = Array.from(firstCurrencyByPan4.entries()).map(
      ([pan4, currencyCode]) => ({
        externalAccountId: pan4,
        label: `Bybit Card •••${pan4}`,
        currencyCode,
        accountType: "bybit-card",
        cardLast4: [pan4],
        balance: cardBalanceUsd,
      }),
    );

    return { externals, rows, cardLast4ByExternal };
  },

  async disconnect(ctx: AdapterContext) {
    await ctx.saveSecrets({});
    await ctx.setStatus("DISCONNECTED");
    log(`disconnect: cleared secrets`);
  },
};

// Re-export constants used by the sync orchestrator
export const BYBIT_CARD_NINETY_DAYS_MS = NINETY_DAYS_MS;
export const BYBIT_CARD_TWENTY_FOUR_HOURS_MS = TWENTY_FOUR_HOURS_MS;
