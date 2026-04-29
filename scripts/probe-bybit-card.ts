/**
 * Bybit Card integration smoke test.
 *
 * Run on prod (IP-allowlisted to 45.39.33.7):
 *   BYBIT_API_KEY=xxx BYBIT_API_SECRET=yyy npx tsx scripts/probe-bybit-card.ts
 *
 * Or with .env file:
 *   npx tsx scripts/probe-bybit-card.ts
 *
 * Fetches the last 7 days of card transactions, prints the first 3 records
 * with pan4 masked to **XXXX. Exits 0 on success, 1 on error.
 */
import "dotenv/config";
import { listCardTransactions } from "@/lib/integrations/bybit/card-records";
import type { BybitCardRecord } from "@/lib/integrations/bybit/types";

function maskPan4(pan4: string): string {
  return `**${pan4.slice(-4)}`;
}

function summarizeRecord(record: BybitCardRecord): Record<string, unknown> {
  return {
    txnId: record.txnId,
    pan4: maskPan4(record.pan4),
    tradeStatus: record.tradeStatus,
    side: record.side,
    txnCreate: new Date(Number(record.txnCreate)).toISOString(),
    basicAmount: record.basicAmount,
    basicCurrency: record.basicCurrency,
    transactionAmount: record.transactionAmount,
    transactionCurrency: record.transactionCurrency,
    paidAmount: record.paidAmount,
    paidCurrency: record.paidCurrency,
    merchName: record.merchName,
    mccCode: record.mccCode,
    declinedReason: record.declinedReason || "(none)",
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
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  console.log(`Probing Bybit Card API...`);
  console.log(
    `Range: ${new Date(sevenDaysAgo).toISOString()} → ${new Date(now).toISOString()}`,
  );

  let result: Awaited<ReturnType<typeof listCardTransactions>>;
  try {
    result = await listCardTransactions({
      apiKey,
      apiSecret,
      createBeginTime: sevenDaysAgo,
      createEndTime: now,
      pageLimit: 100,
      maxPages: 1,
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

  const { rows, truncated } = result;
  console.log(`\nTotal records fetched: ${rows.length}${truncated ? " (truncated)" : ""}`);

  const preview = rows.slice(0, 3);
  if (preview.length === 0) {
    console.log("No transactions found in the last 7 days.");
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
