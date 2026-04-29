// Bybit V5 Card API — TypeScript types
// Field names mirror the live API response for /v5/card/reward/points/records.
// All numeric fields are strings per Bybit API convention.

export type BybitPointRecord = {
  /** Last 4 digits of the card PAN. */
  pan4: string;
  /** Cashback / reward points earned on this transaction. */
  point: number;
  /** Direction: e.g. "debit", "credit". */
  side: string;
  /** Record type (e.g. "consume"). */
  type: string;
  /** Record sub-type. */
  subType: string;
  /** Record creation timestamp, ms epoch (string). */
  createTime: string;
  /** Record update timestamp, ms epoch (string). */
  updateTime: string;
  /** Bybit business ID. */
  bizId: string;
  /** Bybit business transaction ID. */
  bizTxnId: string;
  /** Transaction date, ms epoch (string). Empty string if unavailable. */
  transactionDate: string;
  /** Bybit transaction ID. Empty string if not a card spend. */
  transactionId: string;
  /** Transaction amount in basicCurrency (string-encoded decimal). */
  transactionAmount: string;
  /** Settlement / base currency code (e.g. "USD"). */
  basicCurrency: string;
  /** Human-readable merchant category description. */
  merchCategoryDesc: string;
  /** Merchant name. Empty string for non-spend rows. */
  merchName: string;
  /** Merchant country code. */
  merchCountry: string;
  /** Merchant city. */
  merchCity: string;
  /** Amount paid in local/fiat currency. */
  payFiatAmount: string;
  /** Amount in the transaction's local currency. */
  transactionCurrencyAmount: string;
  /** External order ID. */
  outOrderId: string;
  /** Allow extra fields from passthrough. */
  [key: string]: unknown;
};

/** Narrowed variant: guaranteed to represent a real card spend (non-empty transactionId, merchName, transactionAmount, transactionDate). */
export type BybitPointRecordFiltered = BybitPointRecord & {
  transactionId: string;
  merchName: string;
  transactionAmount: string;
  transactionDate: string;
};

export type BybitV5Envelope<T> = {
  retCode: number;
  retMsg: string;
  result: T;
  retExtInfo: Record<string, unknown>;
  time: number;
};

export type BybitErrorClass =
  | "sign_invalid"
  | "auth_failed"
  | "rate_limit"
  | "timestamp_drift"
  | "network_error"
  | "parse_error"
  | "unknown";

export class BybitApiError extends Error {
  readonly retCode: number;
  readonly retMsg: string;
  readonly class: BybitErrorClass;
  readonly cause?: unknown;

  constructor(opts: {
    retCode: number;
    retMsg: string;
    class: BybitErrorClass;
    cause?: unknown;
  }) {
    super(`Bybit API error ${opts.retCode}: ${opts.retMsg}`);
    this.name = "BybitApiError";
    this.retCode = opts.retCode;
    this.retMsg = opts.retMsg;
    this.class = opts.class;
    this.cause = opts.cause;
  }
}
