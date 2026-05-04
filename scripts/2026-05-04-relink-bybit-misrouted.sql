-- Fix: Bybit Card transactions misrouted to wrong account with wrong source
--
-- Background: Before the Phase 1 code fix (bybit-card.ts runSync accountId lookup),
-- Bybit Card rows had no accountId set, so they fell into Bucket B (legacy CSV path).
-- Bucket B assigned source='tinkoff-retail' (hardcoded) and picked the first account
-- by sortOrder instead of the linked Bybit Card account.
--
-- This script re-links the misrouted rows to the correct account and corrects source.
--
-- Prerequisites:
--   1. Deploy Phase 1 code changes first (bybit-card adapter + Bucket B source fix).
--      New syncs will route correctly; this script only fixes historical data.
--   2. Take a pg_dump snapshot before running:
--      pg_dump -h localhost -p 5433 -U bdg budget_tracker > backup-before-relink-bybit.sql
--
-- Run via:
--   npx prisma db execute --file code/scripts/2026-05-04-relink-bybit-misrouted.sql --schema code/prisma/schema.prisma
--
-- Heuristic: rows where
--   accountId  = 'cmoj80mjj029527pj9bpshl1n'  (first account by sortOrder — the wrong fallback)
--   source     = 'tinkoff-retail'               (Bucket B hardcode)
--   externalId ~ '^[0-9]{18}$'                 (Bybit transactionId format: 18-digit numeric string)
--   deletedAt IS NULL
--
-- Target Bybit Card account id is pre-filled from prod (confirmed 2026-05-04).
-- Verify it still matches before uncommenting Step 2:
--   SELECT id, name FROM "Account" WHERE name ILIKE '%bybit%';

-- ─── Step 0: Verify the two account ids still match the expected names ─────
SELECT id, name, "sortOrder" FROM "Account"
WHERE id IN ('cmoj80mjj029527pj9bpshl1n', 'cmok0qayw00id2eo2jdhkzjob')
  AND "deletedAt" IS NULL;
-- Expected: cmoj80mjj029527pj9bpshl1n = задачка (wrong, fallback target)
--           cmok0qayw00id2eo2jdhkzjob = Bybit Card (correct target)

-- ─── Step 1: Dry run — confirm affected rows ───────────────────────────────
SELECT
  id,
  "externalId",
  "occurredAt",
  amount,
  "currencyCode",
  source,
  "accountId"
FROM "Transaction"
WHERE
  "accountId" = 'cmoj80mjj029527pj9bpshl1n'
  AND source = 'tinkoff-retail'
  AND "externalId" ~ '^[0-9]{18}$'
  AND "deletedAt" IS NULL
ORDER BY "occurredAt" DESC;

-- ─── Step 2: Update — uncomment after confirming dry-run output looks correct ─

-- UPDATE "Transaction"
-- SET
--   "accountId" = 'cmok0qayw00id2eo2jdhkzjob',
--   source = 'bybit-card'
-- WHERE
--   "accountId" = 'cmoj80mjj029527pj9bpshl1n'
--   AND source = 'tinkoff-retail'
--   AND "externalId" ~ '^[0-9]{18}$'
--   AND "deletedAt" IS NULL;
