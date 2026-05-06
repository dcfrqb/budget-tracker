import { bybitFetch } from "./client";
import { bybitDepositRecordsEnvelopeSchema } from "./zod";
import type { BybitDepositRecord } from "./types";

const DEPOSIT_RECORDS_PATH = "/v5/asset/deposit/query-record";

// Bybit constraint: max 30-day window per call for deposit history.
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 50;

// Deposit status: 3 = success (on-chain confirmed). All other values are
// pending, processing, failed, or unknown — skip them.
const DEPOSIT_SUCCESS_STATUS = 3;

type ListDepositsInput = {
  apiKey: string;
  apiSecret: string;
  startTime: number;
  endTime: number;
};

type ListDepositsResult = {
  rows: BybitDepositRecord[];
  rawCount: number;
  truncated: boolean;
};

type DepositEnvelopeOut = {
  retCode: number;
  retMsg: string;
  result: {
    rows: BybitDepositRecord[];
    nextPageCursor?: string | null;
  };
};

async function fetchDepositChunk(opts: {
  apiKey: string;
  apiSecret: string;
  startTime: number;
  endTime: number;
}): Promise<{ rows: BybitDepositRecord[]; truncated: boolean }> {
  const allRows: BybitDepositRecord[] = [];
  let cursor: string | null | undefined = undefined;
  let truncated = false;

  while (true) {
    const params: Record<string, unknown> = {
      limit: PAGE_LIMIT,
      startTime: opts.startTime,
      endTime: opts.endTime,
    };
    if (cursor) {
      params["cursor"] = cursor;
    }

    const result = await bybitFetch<Record<string, unknown>, DepositEnvelopeOut>({
      apiKey: opts.apiKey,
      apiSecret: opts.apiSecret,
      path: DEPOSIT_RECORDS_PATH,
      method: "GET",
      body: params,
      schema: bybitDepositRecordsEnvelopeSchema,
    });

    const rows = result.result.rows;
    allRows.push(...rows);

    const nextCursor = result.result.nextPageCursor;
    if (!nextCursor || nextCursor === "") {
      break;
    }

    cursor = nextCursor;
  }

  return { rows: allRows, truncated };
}

export async function listDeposits(input: ListDepositsInput): Promise<ListDepositsResult> {
  const { apiKey, apiSecret, startTime, endTime } = input;

  const allRows: BybitDepositRecord[] = [];
  let rawCount = 0;
  let truncated = false;
  let skippedCount = 0;

  // Walk the requested range in 30-day chunks (Bybit constraint).
  let chunkStart = startTime;
  while (chunkStart < endTime) {
    const chunkEnd = Math.min(chunkStart + MAX_WINDOW_MS - 1, endTime);

    const chunk = await fetchDepositChunk({
      apiKey,
      apiSecret,
      startTime: chunkStart,
      endTime: chunkEnd,
    });

    rawCount += chunk.rows.length;
    if (chunk.truncated) truncated = true;

    for (const row of chunk.rows) {
      if (row.status !== DEPOSIT_SUCCESS_STATUS) {
        skippedCount++;
        continue;
      }
      allRows.push(row);
    }

    chunkStart = chunkEnd + 1;
  }

  if (skippedCount > 0) {
    console.log(
      `[bybit/deposits] Skipped ${skippedCount} non-success rows (rawCount=${rawCount})`,
    );
  }

  return { rows: allRows, rawCount, truncated };
}
