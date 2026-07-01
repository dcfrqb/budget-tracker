import { bybitFetch } from "./client";
import { bybitCardAssetRecordsEnvelopeSchema } from "./zod";
import type { BybitCardAssetRecord, BybitCardAssetRecordFiltered } from "./types";

const ASSET_RECORDS_PATH = "/v5/card/transaction/query-asset-records";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 50;

/**
 * One-time migration boundary: 2026-06-24T00:00:00Z in ms epoch.
 *
 * Background: the adapter previously sourced card spends from
 * /v5/card/reward/points/records (reward-points ledger). Bybit stopped
 * updating that ledger after ~2026-06-24. The new live endpoint is
 * /v5/card/transaction/query-asset-records (this file).
 *
 * Problem: for the same purchase, the old feed recorded the points-award
 * time (hours after purchase), while the new feed records the authorization
 * time. The delta is 6–17 hours — far outside the persist-layer's ±120s
 * fingerprint window — so a naive 90-day backfill would duplicate all ~30
 * historical rows already in the DB from the old feed.
 *
 * Solution: drop any new-feed record whose txnCreate falls on or before this
 * boundary. Only post-cutover purchases (i.e. the ones the old feed missed)
 * are imported. Applied in listCardTransactions when applyCutover=true
 * (the default for sync). listExternalAccounts passes applyCutover=false so
 * card discovery works even if the only recent activity predates the cutover.
 */
const ASSET_RECORDS_CUTOVER_MS = 1782259200000; // 2026-06-24T00:00:00Z

type ListCardTransactionsInput = {
  apiKey: string;
  apiSecret: string;
  /** Optional: ms epoch lower bound. */
  startTime?: number;
  /** Optional: ms epoch upper bound. */
  endTime?: number;
  /** Max records per page (default 100, max 500). */
  pageSize?: number;
  /** Safety cap on pages fetched (default 50). */
  maxPages?: number;
  /**
   * When true (default), records with txnCreate <= ASSET_RECORDS_CUTOVER_MS
   * are dropped to avoid duplicating rows already imported via the old
   * reward-points feed. Set to false for card-discovery (listExternalAccounts).
   */
  applyCutover?: boolean;
};

type ListCardTransactionsResult = {
  /** Rows that passed the filter: cleared, non-declined, non-zero spends. */
  rows: BybitCardAssetRecordFiltered[];
  /** Pre-filter count across all pages (useful for sync-log diagnostics). */
  rawCount: number;
  /** True if pagination was stopped by maxPages before exhausting results. */
  truncated: boolean;
};

type AssetRecordsEnvelopeOut = {
  retCode: number;
  retMsg: string;
  result: {
    data: BybitCardAssetRecord[];
    totalCount: number;
    pageSize: number;
    pageNo: number;
  };
  retExtInfo: Record<string, unknown>;
  time?: number;
};

export async function listCardTransactions(
  input: ListCardTransactionsInput,
): Promise<ListCardTransactionsResult> {
  const {
    apiKey,
    apiSecret,
    startTime,
    endTime,
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = DEFAULT_MAX_PAGES,
    applyCutover = true,
  } = input;

  const allRaw: BybitCardAssetRecord[] = [];
  let page = 1;
  let truncated = false;
  let collectedTotal = 0;
  let serverTotal: number | undefined;

  while (page <= maxPages) {
    const body: Record<string, unknown> = {
      type: "SIDE_QUERY_AUTH",
      page,
      limit: pageSize,
    };

    if (startTime !== undefined) body["createBeginTime"] = startTime;
    if (endTime !== undefined) body["createEndTime"] = endTime;

    const result = await bybitFetch<Record<string, unknown>, AssetRecordsEnvelopeOut>({
      apiKey,
      apiSecret,
      path: ASSET_RECORDS_PATH,
      method: "POST",
      body,
      schema: bybitCardAssetRecordsEnvelopeSchema,
    });

    const pageData = result.result.data;
    if (serverTotal === undefined) {
      serverTotal = result.result.totalCount;
    }

    allRaw.push(...pageData);
    collectedTotal += pageData.length;

    if (
      pageData.length === 0 ||
      (serverTotal !== undefined && collectedTotal >= serverTotal)
    ) {
      break;
    }

    page++;

    if (page > maxPages) {
      truncated = true;
      console.warn(
        `[bybit/card-records] Reached maxPages=${maxPages} — response truncated. ` +
          `Fetched ${allRaw.length} of ${serverTotal ?? "?"} records.`,
      );
    }
  }

  const rawCount = allRaw.length;

  // Keep only real cleared spends:
  // - status "1" = Cleared
  // - declinedReason "0" = not declined
  // - txnId non-empty (real transaction, not an auth hold)
  // - merchName non-empty (actual merchant, not internal Bybit entries)
  // - basicAmount > 0 (real charge, not $0 auth holds)
  const filtered = allRaw.filter(
    (r): r is BybitCardAssetRecordFiltered =>
      r.status === "1" &&
      r.declinedReason === "0" &&
      r.txnId !== "" &&
      r.merchName !== "" &&
      Number(r.basicAmount) > 0,
  );

  // One-time migration cutover: drop records that were already imported via the
  // old reward-points feed to prevent duplicates (see ASSET_RECORDS_CUTOVER_MS).
  const rows = applyCutover
    ? filtered.filter((r) => Number(r.txnCreate) > ASSET_RECORDS_CUTOVER_MS)
    : filtered;

  return { rows, rawCount, truncated };
}
