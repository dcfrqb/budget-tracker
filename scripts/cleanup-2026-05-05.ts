/**
 * One-shot reproducibility script for the 2026-05-05 prod cleanup.
 *
 * On 2026-05-05 a manual SQL patch was applied to prod:
 *   1. Soft-deleted 109 ghost USD rows (source='tinkoff-retail' mis-routed from Bybit adapter).
 *   2. Folded 250 EXPENSE+INCOME orphan pairs into Transfer records.
 *
 * Prod backup: /root/backup_tx_transfer_20260505_153513.sql.gz
 *
 * This script reproduces the same operations on a fresh local DB so that
 * onboarding a new dev machine yields a clean starting state.
 *
 * Run:
 *   docker exec budget-tracker-app npx tsx /app/scripts/cleanup-2026-05-05.ts
 * Or locally (with .env pointing at dev DB on localhost:5433):
 *   npx tsx scripts/cleanup-2026-05-05.ts
 *
 * IDEMPOTENT: soft-delete uses deletedAt guard; autoPairTransfers skips
 * rows that already have transferId set.
 */

import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { autoPairTransfers } from "@/lib/data/_mutations/transfer-pairing";

// ─── Step 1: Soft-delete ghost USD rows ──────────────────────────────────────
//
// Context: before commit b45b997 (2026-05-04), the Bybit adapter hardcoded
// source='tinkoff-retail' and did not resolve accountId per-row. This caused
// USD card-spend records to be written under the wrong accounts ('Business RUB'
// and 'задачка USD') with source='tinkoff-retail'.
//
// On prod, the affected accountIds are known from the DB — they were found by:
//   SELECT DISTINCT account_id FROM transactions
//   WHERE source='tinkoff-retail' AND currency_code='USD'
//   AND deleted_at IS NULL;
//
// LIMITATION: Account IDs are DB-specific (UUIDs assigned at seed/creation
// time). We cannot hardcode prod IDs here. To reproduce:
//
//   1. Connect to your local or prod DB.
//   2. Run the SELECT above to find the accountIds that hold ghost USD rows.
//   3. Populate GHOST_ACCOUNT_IDS below with those IDs.
//   4. Uncomment and run step1().
//
// If GHOST_ACCOUNT_IDS is empty, step 1 is skipped with a warning.

const GHOST_ACCOUNT_IDS: string[] = [
  // "account-uuid-for-Business-RUB",
  // "account-uuid-for-задачка-USD",
];

async function step1SoftDeleteGhostRows(): Promise<void> {
  if (GHOST_ACCOUNT_IDS.length === 0) {
    console.warn(
      "[step1] GHOST_ACCOUNT_IDS is empty — skipping ghost-row soft-delete.\n" +
      "        Populate the array at the top of this script with the account UUIDs\n" +
      "        that hold mis-routed USD rows under source='tinkoff-retail'."
    );
    return;
  }

  const result = await db.transaction.updateMany({
    where: {
      userId: DEFAULT_USER_ID,
      source: "tinkoff-retail",
      currencyCode: "USD",
      accountId: { in: GHOST_ACCOUNT_IDS },
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      note: "soft-deleted:2026-05-05:bybit-ghost-misrouted",
    },
  });

  console.log(`[step1] Soft-deleted ${result.count} ghost USD rows under source='tinkoff-retail'.`);
}

// ─── Step 2: Fold orphan EXPENSE+INCOME pairs into Transfer records ───────────
//
// On prod, 250 same-amount same-currency pairs (EXPENSE on account A, INCOME
// on account B, Δt ≤ 5 min, name matching /между своими|перевод/i) were
// collapsed into Transfer records with notes:
//   'auto-paired:2026-05-05:between-own-accounts'
//   'auto-paired:2026-05-05:orphan-transfer-rows'
//
// autoPairTransfers() in transfer-pairing.ts does exactly this, with the
// same-currency + cross-currency matching logic. Calling it with no windowFrom
// causes it to look back DEFAULT_LOOKBACK_DAYS (90d) from today.
//
// For a full historical backfill (all time), pass windowFrom=epoch.

async function step2PairOrphanTransfers(): Promise<void> {
  console.log("[step2] Running autoPairTransfers over full history (no time bound)...");

  const result = await autoPairTransfers({
    userId: DEFAULT_USER_ID,
    windowFrom: new Date(0), // epoch — cover all historical data
  });

  console.log(
    `[step2] Paired: sameCcy=${result.paired} crossCcy=${result.crossCcyPaired} ` +
    `ambiguousSkipped=${result.ambiguousSkipped}`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== cleanup-2026-05-05 ===");
  console.log("User:", DEFAULT_USER_ID);

  await step1SoftDeleteGhostRows();
  await step2PairOrphanTransfers();

  console.log("=== done ===");
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
