// Bybit V5 Card API — TypeScript types
// Field names mirror the live API response for /v5/card/transaction/query-asset-records.
// All numeric fields are strings per Bybit API convention.

export type BybitTradeStatus =
  | "success"
  | "declined"
  | "refund"
  | "reversal";

export type BybitCardRecord = {
  /** Last 4 digits of the card PAN. */
  pan4: string;
  /** Trade outcome status. */
  tradeStatus: BybitTradeStatus;
  /** Direction: "0" = debit, "1" = credit (refund/reversal). */
  side: string;
  /** Amount in base/settlement currency (string-encoded decimal). */
  basicAmount: string;
  /** Settlement currency code (e.g. "USDT"). */
  basicCurrency: string;
  /** Amount in transaction/local currency. */
  transactionAmount: string;
  /** Local currency code (e.g. "USD", "EUR", "RUB"). */
  transactionCurrency: string;
  /** Amount actually paid from the card balance. */
  paidAmount: string;
  /** Currency the card balance was debited in. */
  paidCurrency: string;
  /** Transaction creation timestamp, milliseconds epoch. */
  txnCreate: string;
  /** Merchant name. */
  merchName: string;
  /** Merchant Category Code. */
  mccCode: string;
  /** Human-readable category derived from MCC. */
  merchCategoryDesc: string;
  /** Bybit transaction ID. */
  txnId: string;
  /** Bybit order number. */
  orderNo: string;
  /** Reason string when tradeStatus is "declined". Empty string otherwise. */
  declinedReason: string;
  /** Total fees charged for this transaction. */
  totalFees: string;
  /** Bonus/cashback amount credited. */
  bonusAmount: string;
  /** Raw status code from Bybit (may duplicate tradeStatus). */
  status: string;
};

export type BybitCardPage = {
  rows: BybitCardRecord[];
  /** Total count of records (string-encoded integer). */
  count: string;
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
