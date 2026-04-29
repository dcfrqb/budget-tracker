/**
 * Bybit Card integration smoke test.
 *
 * Run on prod (IP-allowlisted to 45.39.33.7):
 *   BYBIT_API_KEY=xxx BYBIT_API_SECRET=yyy npx tsx scripts/probe-bybit-card.ts
 *
 * Or with .env file:
 *   npx tsx scripts/probe-bybit-card.ts
 *
 * Fetches the last 90 days of card transactions via /v5/card/reward/points/records,
 * prints the first 3 records with pan4 masked to **XXXX. Exits 0 on success, 1 on error.
 */
import "dotenv/config";
import { listCardTransactions } from "@/lib/integrations/bybit/card-records";
import type { BybitPointRecordFiltered } from "@/lib/integrations/bybit/types";

function maskPan4(pan4: string): string {
  return `**${pan4.slice(-4)}`;
}

function summarizeRecord(record: BybitPointRecordFiltered): Record<string, unknown> {
  return {
    transactionId: record.transactionId,
    pan4: maskPan4(record.pan4),
    txnDate: new Date(Number(record.transactionDate)).toISOString(),
    amount: record.transactionAmount,
    currency: record.basicCurrency,
    merchant: record.merchName,
    location: `${record.merchCity || "?"}, ${record.merchCountry || "?"}`,
    points: record.point,
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

  console.log(`Probing Bybit Card API (/v5/card/reward/points/records)...`);
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
      pageSize: 50,
      maxPages: 5,
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

  console.log("\nProbe complete. Exit 0.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
