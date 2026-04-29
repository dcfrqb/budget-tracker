import { bybitFetch } from "./client";
import { bybitPointsRecordsEnvelopeSchema } from "./zod";
import type { BybitPointRecord, BybitPointRecordFiltered } from "./types";

const POINTS_RECORDS_PATH = "/v5/card/reward/points/records";
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = 50;

type ListCardTransactionsInput = {
  apiKey: string;
  apiSecret: string;
  /** Optional: ms epoch lower bound. */
  startTime?: number;
  /** Optional: ms epoch upper bound. */
  endTime?: number;
  /** Max records per page (default 50). */
  pageSize?: number;
  /** Safety cap on pages fetched (default 50). */
  maxPages?: number;
};

type ListCardTransactionsResult = {
  /** Rows that passed the filter: non-empty transactionId and merchName. */
  rows: BybitPointRecordFiltered[];
  /** Pre-filter count across all pages (useful for sync-log diagnostics). */
  rawCount: number;
  /** True if pagination was stopped by maxPages before exhausting results. */
  truncated: boolean;
};

type PointsEnvelopeOut = {
  retCode: number;
  retMsg: string;
  result: {
    data: BybitPointRecord[];
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
  } = input;

  const allRaw: BybitPointRecord[] = [];
  let page = 1;
  let truncated = false;

  while (page <= maxPages) {
    const body: Record<string, unknown> = {
      pageSize,
      pageNo: page,
    };

    if (startTime !== undefined) body["startTime"] = startTime;
    if (endTime !== undefined) body["endTime"] = endTime;

    const result = await bybitFetch<Record<string, unknown>, PointsEnvelopeOut>({
      apiKey,
      apiSecret,
      path: POINTS_RECORDS_PATH,
      method: "POST",
      body,
      schema: bybitPointsRecordsEnvelopeSchema,
    });

    const rows = result.result.data;
    allRaw.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    page++;

    if (page > maxPages) {
      truncated = true;
      console.warn(
        `[bybit/card-records] Reached maxPages=${maxPages} — response truncated. ` +
          `Fetched ${allRaw.length} records so far.`,
      );
    }
  }

  const rawCount = allRaw.length;

  // Client-side time filter (safety net — server-side filter not yet verified for this endpoint)
  const timeFiltered =
    startTime !== undefined || endTime !== undefined
      ? allRaw.filter((r) => {
          const ts = r.transactionDate ? Number(r.transactionDate) : 0;
          if (startTime !== undefined && ts < startTime) return false;
          if (endTime !== undefined && ts > endTime) return false;
          return true;
        })
      : allRaw;

  // Only keep rows that represent real card spends
  const filtered = timeFiltered.filter(
    (r): r is BybitPointRecordFiltered =>
      r.transactionId !== "" &&
      r.merchName !== "" &&
      r.transactionAmount !== "" &&
      r.transactionDate !== "",
  );

  return { rows: filtered, rawCount, truncated };
}
