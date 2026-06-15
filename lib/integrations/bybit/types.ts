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
