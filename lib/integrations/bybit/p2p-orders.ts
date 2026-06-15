import { bybitFetch } from "./client";
import { bybitP2pOrderListEnvelopeSchema } from "./zod";
import type { BybitP2pOrderRecord } from "./types";

const P2P_ORDER_LIST_PATH = "/v5/p2p/order/simplifyList";
// Bybit's P2P simplifyList caps `size` at 30 — larger values return an empty
// result set (no error), so 50 silently yielded zero orders. Verified live
// 2026-06-15: size 10/20/30 return data, 40/50 return empty.
const PAGE_SIZE = 30;

// P2P completed buy order status
const P2P_ORDER_COMPLETED_STATUS = 50;
const P2P_ORDER_SIDE_BUY = 0;

type ListP2pOrdersInput = {
  apiKey: string;
  apiSecret: string;
  startTime: number;
  endTime: number;
};

type ListP2pOrdersResult = {
  rows: BybitP2pOrderRecord[];
  rawCount: number;
  truncated: boolean;
};

type P2pEnvelopeOut = {
  result: {
    count: number;
    items: BybitP2pOrderRecord[];
  };
  retCode?: number;
  retMsg?: string;
};

export async function listP2pOrders(input: ListP2pOrdersInput): Promise<ListP2pOrdersResult> {
  const { apiKey, apiSecret, startTime, endTime } = input;

  const allRows: BybitP2pOrderRecord[] = [];
  let rawCount = 0;
  let truncated = false;
  let page = 1;

  while (true) {
    const result = await bybitFetch<Record<string, unknown>, P2pEnvelopeOut>({
      apiKey,
      apiSecret,
      path: P2P_ORDER_LIST_PATH,
      method: "POST",
      body: { page, size: PAGE_SIZE },
      schema: bybitP2pOrderListEnvelopeSchema,
      skipRetCodeGate: true,
    });

    const items = result.result.items ?? [];
    const count = result.result.count ?? 0;

    if (page === 1) {
      rawCount = count;
    }

    if (items.length === 0) break;

    let earlyStop = false;
    for (const item of items) {
      const createMs = Number(item.createDate);

      // Early-stop: orders are returned newest-first; once we pass startTime, done
      if (!isNaN(createMs) && createMs < startTime) {
        earlyStop = true;
        break;
      }

      // Keep only completed BUY orders within the requested window
      if (
        item.status === P2P_ORDER_COMPLETED_STATUS &&
        item.side === P2P_ORDER_SIDE_BUY &&
        !isNaN(createMs) &&
        createMs >= startTime &&
        createMs <= endTime
      ) {
        allRows.push(item as BybitP2pOrderRecord);
      }
    }

    if (earlyStop) break;

    const fetched = page * PAGE_SIZE;
    if (items.length < PAGE_SIZE || fetched >= count) break;

    if (count > 0 && fetched < count && items.length >= PAGE_SIZE) {
      // Still more pages available
      page++;
      continue;
    }

    break;
  }

  // If total count suggests more records exist but we stopped early, mark truncated
  if (rawCount > page * PAGE_SIZE && !truncated) {
    console.log(
      `[bybit/p2p-orders] pagination may not have covered all ${rawCount} records (fetched up to page ${page})`
    );
    truncated = true;
  }

  return { rows: allRows, rawCount, truncated };
}
