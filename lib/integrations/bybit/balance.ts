import { Prisma } from "@prisma/client";
import { bybitFetch } from "./client";
import {
  bybitWalletBalanceUnifiedSchema,
  bybitFundBalanceSchema,
  bybitEarnPositionSchema,
} from "./zod";
import { BybitApiError } from "./types";
import type { SpendingPowerResult } from "./types";

const STABLECOIN_LIST = [
  "USDT",
  "USDC",
  "USD",
  "FDUSD",
  "DAI",
  "TUSD",
  "USDe",
  "PYUSD",
] as const;

export const STABLECOINS: ReadonlySet<string> = new Set(
  STABLECOIN_LIST.map((c) => c.toUpperCase()),
);

function isStable(coin: string): boolean {
  return STABLECOINS.has(coin.toUpperCase());
}

function decimalFromString(s: string | undefined | null): Prisma.Decimal {
  if (!s || s.trim() === "") return new Prisma.Decimal(0);
  try {
    return new Prisma.Decimal(s);
  } catch {
    return new Prisma.Decimal(0);
  }
}

function errorReason(err: unknown): string {
  if (err instanceof BybitApiError) return `bybit:${err.class} ${err.retMsg}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

type UtaResult =
  | { ok: true; usd: string }
  | { ok: false; reason: string };

type FundResult =
  | { ok: true; usd: string; skippedCoins: string[] }
  | { ok: false; reason: string };

type EarnResult =
  | { ok: true; usd: string; skippedCoins: string[]; categories: string[] }
  | { ok: false; reason: string };

async function fetchUta(apiKey: string, apiSecret: string): Promise<UtaResult> {
  const data = await bybitFetch({
    apiKey,
    apiSecret,
    path: "/v5/account/wallet-balance",
    method: "GET",
    body: { accountType: "UNIFIED" },
    schema: bybitWalletBalanceUnifiedSchema,
  });

  const list = (data as { result: { list: Array<{ totalEquity: string }> } }).result.list;
  const equity = list[0]?.totalEquity ?? "0";
  const usd = decimalFromString(equity).toFixed(10);
  return { ok: true, usd };
}

async function fetchFund(apiKey: string, apiSecret: string): Promise<FundResult> {
  const data = await bybitFetch({
    apiKey,
    apiSecret,
    path: "/v5/asset/transfer/query-account-coins-balance",
    method: "GET",
    body: { accountType: "FUND" },
    schema: bybitFundBalanceSchema,
  });

  const balance = (data as { result: { balance: Array<{ coin: string; walletBalance: string }> } }).result.balance;
  let sum = new Prisma.Decimal(0);
  const skipped: string[] = [];

  for (const entry of balance) {
    const coin = entry.coin ?? "";
    if (isStable(coin)) {
      sum = sum.plus(decimalFromString(entry.walletBalance));
    } else {
      const amt = decimalFromString(entry.walletBalance);
      if (!amt.isZero()) {
        skipped.push(coin);
      }
    }
  }

  return { ok: true, usd: sum.toFixed(10), skippedCoins: skipped };
}

async function fetchEarn(apiKey: string, apiSecret: string): Promise<EarnResult> {
  const categories = ["FlexibleSaving", "OnChain"] as const;

  const results = await Promise.allSettled(
    categories.map((category) =>
      bybitFetch({
        apiKey,
        apiSecret,
        path: "/v5/earn/position",
        method: "GET",
        body: { category },
        schema: bybitEarnPositionSchema,
      }).then((data) => ({
        category,
        list: (data as { result: { list: Array<{ coin: string; amount: string }> } }).result.list,
      })),
    ),
  );

  let sum = new Prisma.Decimal(0);
  const skipped: string[] = [];
  const succeededCategories: string[] = [];
  let anyOk = false;
  const failReasons: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      anyOk = true;
      succeededCategories.push(result.value.category);
      for (const entry of result.value.list) {
        const coin = entry.coin ?? "";
        if (isStable(coin)) {
          sum = sum.plus(decimalFromString(entry.amount));
        } else {
          const amt = decimalFromString(entry.amount);
          if (!amt.isZero()) {
            skipped.push(coin);
          }
        }
      }
    } else {
      failReasons.push(errorReason(result.reason));
    }
  }

  if (!anyOk) {
    return { ok: false, reason: failReasons.join("; ") };
  }

  const partial = succeededCategories.length < categories.length;
  if (partial) {
    console.warn(`[bybit/balance] earn: partial — succeeded=${succeededCategories.join(",")} failures=${failReasons.join("; ")}`);
  }

  return {
    ok: true,
    usd: sum.toFixed(10),
    skippedCoins: [...new Set(skipped)].sort(),
    categories: succeededCategories,
  };
}

export async function fetchCardSpendingPower(input: {
  apiKey: string;
  apiSecret: string;
}): Promise<SpendingPowerResult> {
  const { apiKey, apiSecret } = input;

  const [utaSettled, fundSettled, earnSettled] = await Promise.allSettled([
    fetchUta(apiKey, apiSecret),
    fetchFund(apiKey, apiSecret),
    fetchEarn(apiKey, apiSecret),
  ]);

  const utaResult: SpendingPowerResult["sources"]["uta"] =
    utaSettled.status === "fulfilled"
      ? utaSettled.value
      : { ok: false, reason: errorReason(utaSettled.reason) };

  const fundResult: SpendingPowerResult["sources"]["fund"] =
    fundSettled.status === "fulfilled"
      ? fundSettled.value
      : { ok: false, reason: errorReason(fundSettled.reason) };

  const earnResult: SpendingPowerResult["sources"]["earn"] =
    earnSettled.status === "fulfilled"
      ? earnSettled.value
      : { ok: false, reason: errorReason(earnSettled.reason) };

  const allFailed = !utaResult.ok && !fundResult.ok && !earnResult.ok;

  let total = new Prisma.Decimal(0);
  if (utaResult.ok) total = total.plus(new Prisma.Decimal(utaResult.usd));
  if (fundResult.ok) total = total.plus(new Prisma.Decimal(fundResult.usd));
  if (earnResult.ok) total = total.plus(new Prisma.Decimal(earnResult.usd));

  const skippedFund = fundResult.ok ? fundResult.skippedCoins : [];
  const skippedEarn = earnResult.ok ? earnResult.skippedCoins : [];
  const allSkipped = [...new Set([...skippedFund, ...skippedEarn])].sort();

  const partial =
    !utaResult.ok ||
    !fundResult.ok ||
    !earnResult.ok ||
    (earnResult.ok && earnResult.categories.length < 2);

  if (allFailed) {
    console.error(`[bybit/balance] fetchCardSpendingPower: all three sources failed`);
  }

  return {
    totalUsd: total.toFixed(10),
    sources: {
      uta: utaResult,
      fund: fundResult,
      earn: earnResult,
    },
    skippedCoins: allSkipped,
    partial,
  };
}
