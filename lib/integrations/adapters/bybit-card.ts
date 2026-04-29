import type { BankAdapter, AdapterContext } from "@/lib/integrations/types";
import type { ImportRow } from "@/lib/import/types";
import { listCardTransactions } from "@/lib/integrations/bybit/card-records";
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
        createBeginTime: probeFrom,
        createEndTime: now,
        pageLimit: 1,
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
        createBeginTime: from,
        createEndTime: now,
        pageLimit: 100,
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

    // Group by pan4; first-observed transactionCurrency per card
    const firstCurrencyByPan4 = new Map<string, string>();
    for (const row of result.rows) {
      if (!firstCurrencyByPan4.has(row.pan4)) {
        firstCurrencyByPan4.set(row.pan4, row.transactionCurrency);
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
        createBeginTime: from.getTime(),
        createEndTime: to.getTime(),
        pageLimit: 100,
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

    const rows: ImportRow[] = [];
    const firstCurrencyByPan4 = new Map<string, string>();
    const cardLast4ByExternal = new Map<string, string[]>();

    for (const record of result.rows) {
      // Declined: skip entirely
      if (record.tradeStatus === "declined") {
        log(`runSync: skip declined txnId=${record.txnId}`);
        continue;
      }

      // Reversal: skip and log
      if (record.tradeStatus === "reversal") {
        log(`runSync: reversal skipped: txnId=${record.txnId}`);
        continue;
      }

      // Track first-seen currency per card (for account auto-creation metadata)
      if (!firstCurrencyByPan4.has(record.pan4)) {
        firstCurrencyByPan4.set(record.pan4, record.transactionCurrency);
      }

      // Track card last-4 per external account id
      if (!cardLast4ByExternal.has(record.pan4)) {
        cardLast4ByExternal.set(record.pan4, []);
      }
      const pan4List = cardLast4ByExternal.get(record.pan4)!;
      if (!pan4List.includes(record.pan4)) {
        pan4List.push(record.pan4);
      }

      // Refund → INCOME; success → EXPENSE
      const kind: ImportRow["kind"] =
        record.tradeStatus === "refund" ? "INCOME" : "EXPENSE";
      const direction: ImportRow["direction"] =
        record.tradeStatus === "refund" ? "in" : "out";

      const occurredAt = new Date(parseInt(record.txnCreate, 10)).toISOString();

      const note = JSON.stringify({
        bybit: {
          mcc: record.mccCode,
          paid: { amount: record.paidAmount, currency: record.paidCurrency },
          fees: record.totalFees,
          basic: { amount: record.basicAmount, currency: record.basicCurrency },
        },
      });

      const description =
        record.merchName ||
        record.merchCategoryDesc ||
        "Bybit Card";

      const row: ImportRow = {
        externalId: record.txnId,
        occurredAt,
        amount: record.transactionAmount,
        currencyCode: record.transactionCurrency,
        kind,
        direction,
        description,
        cardLast4: record.pan4,
        source: "bybit-card",
        note,
        raw: {
          txnId: record.txnId,
          orderNo: record.orderNo,
          tradeStatus: record.tradeStatus,
          mccCode: record.mccCode,
        },
      };

      rows.push(row);
    }

    log(`runSync: total ImportRows=${rows.length} from ${result.rows.length} raw records`);

    // Build externals snapshot from rows seen in this sync
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

    return { externals, rows, cardLast4ByExternal };
  },

  async disconnect(ctx: AdapterContext) {
    await ctx.saveSecrets({});
    await ctx.setStatus("DISCONNECTED");
    log(`disconnect: cleared secrets`);
  },
};
