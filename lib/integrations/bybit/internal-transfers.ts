import { bybitFetch } from "./client";
import { bybitInternalTransferListEnvelopeSchema } from "./zod";

const INTER_TRANSFER_PATH = "/v5/asset/transfer/query-inter-transfer-list";

// Bybit constraint: max 7-day window per call for internal transfer history.
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 50;

// Internal transfer status: "SUCCESS" = success.
const TRANSFER_SUCCESS_STATUS = "SUCCESS";

type ListInternalTransfersInput = {
  apiKey: string;
  apiSecret: string;
  startTime: number;
  endTime: number;
};

type ListInternalTransfersResult = {
  rawCount: number;
};

type InterTransferEnvelopeOut = {
  retCode: number;
  retMsg: string;
  result: {
    list: Array<{ status: string; [key: string]: unknown }>;
    nextPageCursor?: string | null;
  };
};

async function fetchTransferChunk(opts: {
  apiKey: string;
  apiSecret: string;
  startTime: number;
  endTime: number;
}): Promise<number> {
  let count = 0;
  let cursor: string | null | undefined = undefined;

  while (true) {
    const params: Record<string, unknown> = {
      limit: PAGE_LIMIT,
      startTime: opts.startTime,
      endTime: opts.endTime,
    };
    if (cursor) {
      params["cursor"] = cursor;
    }

    const result = await bybitFetch<Record<string, unknown>, InterTransferEnvelopeOut>({
      apiKey: opts.apiKey,
      apiSecret: opts.apiSecret,
      path: INTER_TRANSFER_PATH,
      method: "GET",
      body: params,
      schema: bybitInternalTransferListEnvelopeSchema,
    });

    const rows = result.result.list;
    const successRows = rows.filter((r) => r.status === TRANSFER_SUCCESS_STATUS);
    count += successRows.length;

    const nextCursor = result.result.nextPageCursor;
    if (!nextCursor || nextCursor === "") {
      break;
    }

    cursor = nextCursor;
  }

  return count;
}

// Fetch-only — does NOT persist rows. Internal Funding↔UTA moves are not
// net-worth events. Returns rawCount so the adapter can log the volume.
export async function listInternalTransfers(
  input: ListInternalTransfersInput,
): Promise<ListInternalTransfersResult> {
  const { apiKey, apiSecret, startTime, endTime } = input;

  let rawCount = 0;

  // Walk the requested range in 7-day chunks (Bybit constraint).
  let chunkStart = startTime;
  while (chunkStart < endTime) {
    const chunkEnd = Math.min(chunkStart + MAX_WINDOW_MS - 1, endTime);

    const chunkCount = await fetchTransferChunk({
      apiKey,
      apiSecret,
      startTime: chunkStart,
      endTime: chunkEnd,
    });

    rawCount += chunkCount;
    chunkStart = chunkEnd + 1;
  }

  return { rawCount };
}
