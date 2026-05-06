import { bybitFetch } from "./client";
import { bybitWithdrawRecordsEnvelopeSchema } from "./zod";
import type { BybitWithdrawRecord } from "./types";

const WITHDRAW_RECORDS_PATH = "/v5/asset/withdraw/query-record";

// Bybit constraint: max 30-day window per call for withdrawal history.
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 50;

// Withdrawal status: "success" = terminal success. All other values
// (e.g. "pending", "failed", "BlockchainConfirmed" in transit) are skipped.
const WITHDRAW_SUCCESS_STATUS = "success";

type ListWithdrawalsInput = {
  apiKey: string;
  apiSecret: string;
  startTime: number;
  endTime: number;
};

type ListWithdrawalsResult = {
  rows: BybitWithdrawRecord[];
  rawCount: number;
  truncated: boolean;
};

type WithdrawEnvelopeOut = {
  retCode: number;
  retMsg: string;
  result: {
    rows: BybitWithdrawRecord[];
    nextPageCursor?: string | null;
  };
};

async function fetchWithdrawalChunk(opts: {
  apiKey: string;
  apiSecret: string;
  startTime: number;
  endTime: number;
}): Promise<{ rows: BybitWithdrawRecord[]; truncated: boolean }> {
  const allRows: BybitWithdrawRecord[] = [];
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

    const result = await bybitFetch<Record<string, unknown>, WithdrawEnvelopeOut>({
      apiKey: opts.apiKey,
      apiSecret: opts.apiSecret,
      path: WITHDRAW_RECORDS_PATH,
      method: "GET",
      body: params,
      schema: bybitWithdrawRecordsEnvelopeSchema,
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

export async function listWithdrawals(input: ListWithdrawalsInput): Promise<ListWithdrawalsResult> {
  const { apiKey, apiSecret, startTime, endTime } = input;

  const allRows: BybitWithdrawRecord[] = [];
  let rawCount = 0;
  let truncated = false;
  let skippedCount = 0;

  // Walk the requested range in 30-day chunks (Bybit constraint).
  let chunkStart = startTime;
  while (chunkStart < endTime) {
    const chunkEnd = Math.min(chunkStart + MAX_WINDOW_MS - 1, endTime);

    const chunk = await fetchWithdrawalChunk({
      apiKey,
      apiSecret,
      startTime: chunkStart,
      endTime: chunkEnd,
    });

    rawCount += chunk.rows.length;
    if (chunk.truncated) truncated = true;

    for (const row of chunk.rows) {
      if (row.status !== WITHDRAW_SUCCESS_STATUS) {
        skippedCount++;
        continue;
      }
      allRows.push(row);
    }

    chunkStart = chunkEnd + 1;
  }

  if (skippedCount > 0) {
    console.log(
      `[bybit/withdrawals] Skipped ${skippedCount} non-success rows (rawCount=${rawCount})`,
    );
  }

  return { rows: allRows, rawCount, truncated };
}
