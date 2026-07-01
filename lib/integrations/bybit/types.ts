// Bybit V5 Card API — TypeScript types
// Field names mirror the live API response for /v5/card/transaction/query-asset-records.
// All numeric fields are strings per Bybit API convention.

export type BybitCardAssetRecord = {
  /** Last 4 digits of the card PAN. */
  pan4: string;
  /** First 6 digits of the card PAN (BIN). */
  pan6: string;
  /** Trade status string. */
  tradeStatus: string;
  /** Direction: "1" = debit/spend. */
  side: string;
  /** Charged amount in basicCurrency including fees (string-encoded decimal). Load-bearing for import. */
  basicAmount: string;
  /** Settlement currency code (e.g. "USD"). */
  basicCurrency: string;
  /** Transaction amount in transactionCurrency (string-encoded decimal). */
  transactionAmount: string;
  /** Transaction currency code. */
  transactionCurrency: string;
  /** Transaction creation timestamp, ms epoch (STRING). */
  txnCreate: string;
  /** Merchant country code (e.g. "HKG"). */
  merchCountry: string;
  /** Merchant city. */
  merchCity: string;
  /** Merchant name. */
  merchName: string;
  /** Unique transaction ID. Used as externalId. */
  txnId: string;
  /** Decline reason code: "0" = not declined. */
  declinedReason: string;
  /** Total fees charged (string-encoded decimal). */
  totalFees: string;
  /** Foreign transaction fee (string-encoded decimal). */
  foreignTransactionFee: string;
  /** Bill amount (string-encoded decimal). */
  billAmount: string;
  /** Paid amount (string-encoded decimal). */
  paidAmount: string;
  /** Paid currency code. */
  paidCurrency: string;
  /** Status: "0"=Pending, "1"=Cleared, "2"=Declined. */
  status: string;
  /** Internal order number. */
  orderNo: string;
  /** MCC category code. */
  mccCode: string;
  /** Human-readable merchant category description (may equal mccCode). */
  merchCategoryDesc: string;
  /** Allow extra fields from passthrough. */
  [key: string]: unknown;
};

/** Narrowed variant: guaranteed to represent a real cleared card spend. */
export type BybitCardAssetRecordFiltered = BybitCardAssetRecord & {
  txnId: string;
  merchName: string;
  basicAmount: string;
  txnCreate: string;
};

// ── Legacy point-record types (kept for probe-bybit-card.ts compatibility) ───
// These types are no longer used by the sync adapter — the live endpoint
// switched from /v5/card/reward/points/records to /v5/card/transaction/query-asset-records.
// Remove when probe-bybit-card.ts is updated to the new record shape.

export type BybitPointRecord = {
  pan4: string;
  point: number;
  side: string;
  type: string;
  subType: string;
  createTime: string;
  updateTime: string;
  bizId: string;
  bizTxnId: string;
  transactionDate: string;
  transactionId: string;
  transactionAmount: string;
  basicCurrency: string;
  merchCategoryDesc: string;
  merchName: string;
  merchCountry: string;
  merchCity: string;
  payFiatAmount: string;
  transactionCurrencyAmount: string;
  outOrderId: string;
  [key: string]: unknown;
};

// ── Balance aggregation types ────────────────────────────────────────────────

export type BybitUnifiedCoin = {
  coin: string;
  equity: string;
  usdValue: string;
  walletBalance: string;
  availableToWithdraw: string;
  [key: string]: unknown;
};

export type BybitUnifiedAccount = {
  accountType: string;
  totalEquity: string;
  totalAvailableBalance: string;
  totalWalletBalance: string;
  coin: BybitUnifiedCoin[];
  [key: string]: unknown;
};

export type BybitFundCoin = {
  coin: string;
  transferBalance: string;
  walletBalance: string;
  bonus: string;
  [key: string]: unknown;
};

export type BybitEarnPosition = {
  coin: string;
  productId: string;
  amount: string;
  [key: string]: unknown;
};

export type SpendingPowerResult = {
  totalUsd: string;
  sources: {
    uta: { ok: true; usd: string } | { ok: false; reason: string };
    fund: { ok: true; usd: string; skippedCoins: string[] } | { ok: false; reason: string };
    earn: { ok: true; usd: string; skippedCoins: string[]; categories: string[] } | { ok: false; reason: string };
  };
  skippedCoins: string[];
  partial: boolean;
};

// ── Deposit / Withdrawal / Internal Transfer types ───────────────────────────
//
// All Bybit fields are strings on the wire. amount stays as string; callers
// parse to Decimal only inside the adapter.

export type BybitDepositRecord = {
  /** Coin code (e.g. "USDT"). */
  coin: string;
  /** Chain name (e.g. "TRX"). */
  chain: string;
  /** Amount as string-encoded decimal. */
  amount: string;
  /** On-chain transaction hash. */
  txID: string;
  /** Deposit status integer: 3 = success. */
  status: number;
  /** Destination address on Bybit. */
  toAddress: string;
  /** Address tag (for coins that require it). */
  tag: string;
  /** Deposit fee (usually empty string). */
  depositFee: string;
  /** Timestamp when deposit was confirmed on-chain, ms epoch string. */
  successAt: string;
  /** Number of block confirmations (string). */
  confirmations: string;
  /** Transaction sequence number in block. */
  txIndex: string;
  /** Block hash. */
  blockHash: string;
  /** Source address the funds came from. */
  fromAddress: string;
  /** Deposit type identifier ("0" = on-chain). */
  depositType: string;
  [key: string]: unknown;
};

export type BybitWithdrawRecord = {
  /** Coin code (e.g. "USDT"). */
  coin: string;
  /** Chain name (e.g. "ETH"). */
  chain: string;
  /** Amount as string-encoded decimal. */
  amount: string;
  /** On-chain transaction hash. */
  txID: string;
  /** Withdrawal status string: "success" = terminal success. */
  status: string;
  /** Destination address. */
  toAddress: string;
  /** Address tag. */
  tag: string;
  /** Network fee charged. */
  withdrawFee: string;
  /** Creation timestamp, ms epoch string. */
  createTime: string;
  /** Last update timestamp, ms epoch string. */
  updateTime: string;
  /** Bybit withdrawal ID. */
  withdrawId: string;
  /** Withdrawal type: 0 = on-chain. */
  withdrawType: number;
  [key: string]: unknown;
};

// ── P2P Order type ───────────────────────────────────────────────────────────

export type BybitP2pOrderRecord = {
  /** Unique order ID (used as idempotency key, prefixed with "p2p:"). */
  id: string;
  /** 0 = BUY, 1 = SELL. */
  side: number;
  /** Crypto token being received (e.g. "USDT"). */
  tokenId: string;
  /** Notify token id — same as tokenId in practice. */
  notifyTokenId: string;
  /** Fiat amount paid (string-encoded decimal). */
  amount: string;
  /** Fiat currency code (e.g. "RUB"). */
  currencyId: string;
  /** Exchange rate (fiat per 1 USDT). */
  price: string;
  /** USDT quantity received (string-encoded decimal). */
  notifyTokenQuantity: string;
  /** Counterparty nickname. */
  targetNickName?: string;
  /** Counterparty real name. */
  sellerRealName?: string;
  /** Order status integer: 50 = completed. */
  status: number;
  /** Order creation timestamp, ms epoch (string). */
  createDate: string;
  [key: string]: unknown;
};

/** @deprecated Use BybitCardAssetRecordFiltered. Narrowed variant of the old points-records feed. */
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
