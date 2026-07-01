/**
 * Bybit Card integration smoke test.
 *
 * Run on prod (IP-allowlisted):
 *   BYBIT_API_KEY=xxx BYBIT_API_SECRET=yyy npx tsx scripts/probe-bybit-card.ts
 *
 * Or with .env file:
 *   npx tsx scripts/probe-bybit-card.ts
 *
 * Fetches the last 90 days of card transactions via /v5/card/transaction/query-asset-records,
 * prints the first 3 records with pan4 masked to **XXXX. Exits 0 on success, 1 on error.
 */
import "dotenv/config";
import { listCardTransactions } from "@/lib/integrations/bybit/card-records";
import { fetchCardSpendingPower } from "@/lib/integrations/bybit/balance";
import type { BybitCardAssetRecordFiltered } from "@/lib/integrations/bybit/types";

function maskPan4(pan4: string): string {
  return `**${pan4.slice(-4)}`;
}

function summarizeRecord(record: BybitCardAssetRecordFiltered): Record<string, unknown> {
  return {
    txnId: record.txnId,
    pan4: maskPan4(record.pan4),
    txnDate: new Date(Number(record.txnCreate)).toISOString(),
    basicAmount: record.basicAmount,
    basicCurrency: record.basicCurrency,
    transactionAmount: record.transactionAmount,
    transactionCurrency: record.transactionCurrency,
    merchant: record.merchName,
    location: `${record.merchCity || "?"}, ${record.merchCountry || "?"}`,
    status: record.status,
    mccCode: record.mccCode,
    orderNo: record.orderNo,
  };
}

async function main(): Promise<void> {
  const apiKey = process.env["BYBIT_API_KEY"];
  const apiSecret = process.env["BYBIT_API_SECRET"];

  if (!apiKey || !apiSecret) {
    console.error(
      "ERROR: BYBIT_API_KEY and BYBIT_API_SECRET must be set in environment or .env file.",
    );
    process.exit(1);
  }

  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  console.log(`Probing Bybit Card API (/v5/card/transaction/query-asset-records)...`);
  console.log(
    `Range: ${new Date(ninetyDaysAgo).toISOString()} → ${new Date(now).toISOString()}`,
  );

  let result: Awaited<ReturnType<typeof listCardTransactions>>;
  try {
    result = await listCardTransactions({
      apiKey,
      apiSecret,
      startTime: ninetyDaysAgo,
      endTime: now,
      pageSize: 100,
      maxPages: 5,
      applyCutover: false, // probe: show all records, no migration filter
    });
  } catch (e) {
    console.error("ERROR: Request failed.");
    if (e instanceof Error) {
      console.error(`  ${e.name}: ${e.message}`);
      if ("retCode" in e) {
        console.error(`  retCode: ${(e as { retCode: number }).retCode}`);
      }
    } else {
      console.error(e);
    }
    process.exit(1);
  }

  const { rows, rawCount, truncated } = result;
  console.log(
    `\nRaw records fetched: ${rawCount}${truncated ? " (truncated)" : ""}`,
  );
  console.log(`After filter (real card spends): ${rows.length}`);

  const preview = rows.slice(0, 3);
  if (preview.length === 0) {
    console.log("No card spend transactions found in the last 90 days.");
  } else {
    console.log(`\nFirst ${preview.length} record(s):`);
    for (const [i, record] of preview.entries()) {
      console.log(`\n[${i + 1}]`, JSON.stringify(summarizeRecord(record), null, 2));
    }
  }

  console.log("\nProbing Bybit Card balance...");
  try {
    const balanceResult = await fetchCardSpendingPower({ apiKey, apiSecret });

    const utaUsd = balanceResult.sources.uta.ok
      ? `$${Number(balanceResult.sources.uta.usd).toFixed(4)}`
      : `ERROR: ${balanceResult.sources.uta.reason}`;

    const fundUsd = balanceResult.sources.fund.ok
      ? `$${Number(balanceResult.sources.fund.usd).toFixed(4)}${balanceResult.sources.fund.skippedCoins.length > 0 ? `  (skipped: ${balanceResult.sources.fund.skippedCoins.join(", ")})` : ""}`
      : `ERROR: ${balanceResult.sources.fund.reason}`;

    const earnUsd = balanceResult.sources.earn.ok
      ? (() => {
          const parts: string[] = [];
          if (balanceResult.sources.earn.categories.includes("FlexibleSaving")) {
            parts.push(`FlexibleSaving: included`);
          }
          if (balanceResult.sources.earn.categories.includes("OnChain")) {
            parts.push(`OnChain: included`);
          }
          const skipped = balanceResult.sources.earn.skippedCoins.length > 0
            ? `  (skipped: ${balanceResult.sources.earn.skippedCoins.join(", ")})`
            : "";
          return `$${Number(balanceResult.sources.earn.usd).toFixed(4)}${skipped}`;
        })()
      : `ERROR: ${balanceResult.sources.earn.reason}`;

    console.log(`UTA totalEquity:       ${utaUsd}`);
    console.log(`FUND stablecoins:      ${fundUsd}`);
    console.log(`Earn (all):            ${earnUsd}`);
    console.log(`─────────────────────────────`);
    console.log(`Spending Power:        $${Number(balanceResult.totalUsd).toFixed(4)}`);
    console.log(`partial: ${balanceResult.partial}`);

    if (balanceResult.skippedCoins.length > 0) {
      console.log(`skipped coins (non-stable): ${balanceResult.skippedCoins.join(", ")}`);
    }

    if (!balanceResult.sources.uta.ok) {
      console.log(`UTA error: ${balanceResult.sources.uta.reason}`);
    }
    if (!balanceResult.sources.fund.ok) {
      console.log(`FUND error: ${balanceResult.sources.fund.reason}`);
    }
    if (!balanceResult.sources.earn.ok) {
      console.log(`Earn error: ${balanceResult.sources.earn.reason}`);
    }
  } catch (e) {
    console.error("ERROR: Balance fetch failed.");
    if (e instanceof Error) {
      console.error(`  ${e.name}: ${e.message}`);
    } else {
      console.error(e);
    }
  }

  console.log("\nProbe complete. Exit 0.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
