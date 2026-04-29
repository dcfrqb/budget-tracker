import { bybitFetch } from "./client";
import { bybitCardEnvelopeSchema } from "./zod";
import type { BybitCardRecord } from "./types";

const CARD_RECORDS_PATH = "/v5/card/transaction/query-asset-records";
const DEFAULT_PAGE_LIMIT = 100;
const DEFAULT_MAX_PAGES = 50;

type ListCardTransactionsInput = {
  apiKey: string;
  apiSecret: string;
  /** Start of range, ms epoch (inclusive). */
  createBeginTime: number;
  /** End of range, ms epoch (inclusive). */
  createEndTime: number;
  /** Optional status filter: "success" | "declined" | "refund" | "reversal" */
  statusCode?: string;
  /** Max records per page (default 100, max 500). */
  pageLimit?: number;
  /** Safety cap on pages fetched (default 50). */
  maxPages?: number;
};

type ListCardTransactionsResult = {
  rows: BybitCardRecord[];
  /** True if pagination was stopped by maxPages before exhausting results. */
  truncated: boolean;
};

export async function listCardTransactions(
  input: ListCardTransactionsInput,
): Promise<ListCardTransactionsResult> {
  const {
    apiKey,
    apiSecret,
    createBeginTime,
    createEndTime,
    statusCode,
    pageLimit = DEFAULT_PAGE_LIMIT,
    maxPages = DEFAULT_MAX_PAGES,
  } = input;

  const allRows: BybitCardRecord[] = [];
  let page = 1;
  let truncated = false;

  while (page <= maxPages) {
    const body: Record<string, unknown> = {
      createBeginTime: String(createBeginTime),
      createEndTime: String(createEndTime),
      pageLimit: String(Math.min(pageLimit, 500)),
      pageNum: String(page),
    };

    if (statusCode !== undefined) {
      body["statusCode"] = statusCode;
    }

    const result = await bybitFetch<Record<string, unknown>, {
      retCode: number;
      retMsg: string;
      result: { rows: BybitCardRecord[]; count: number };
    }>({
      apiKey,
      apiSecret,
      path: CARD_RECORDS_PATH,
      method: "POST",
      body,
      schema: bybitCardEnvelopeSchema,
    });

    const rows = result.result.rows;
    allRows.push(...rows);

    if (rows.length < pageLimit) {
      break;
    }

    page++;

    if (page > maxPages) {
      truncated = true;
      console.warn(
        `[bybit/card-records] Reached maxPages=${maxPages} — response truncated. ` +
        `Fetched ${allRows.length} records so far.`,
      );
    }
  }

  return { rows: allRows, truncated };
}
