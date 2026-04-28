/**
 * One-shot backfill: tag existing tinkoff-retail transactions that look like
 * inner transfers (description = "Между своими счетами") as kind=TRANSFER.
 *
 * This cleans up April (and prior) data imported before the adapter learned
 * to detect transfer-inner operations at sync time.
 *
 * Idempotent — re-running does nothing if already tagged.
 *
 * Run after deploy:
 *   docker exec budget-tracker-app npx tsx /app/scripts/backfill-tinkoff-transfers.ts
 */

import { db } from "@/lib/db";
import { TransactionKind } from "@prisma/client";

async function main() {
  const result = await db.transaction.updateMany({
    where: {
      source: "tinkoff-retail",
      kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
      name: "Между своими счетами",
    },
    data: { kind: TransactionKind.TRANSFER },
  });
  console.log(`Tagged ${result.count} inner transfer transactions as TRANSFER kind.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
