import { z } from "zod";
import { BybitApiError } from "./types";

// ── Primitive helpers ────────────────────────────────────────────────────────

const coercedNumber = z.coerce.number();

// ── Points record row schema ─────────────────────────────────────────────────
//
// Schema for /v5/card/reward/points/records rows.
// Most fields are optional — Bybit omits empty ones rather than returning null.
// Numeric fields are strings per Bybit API convention.

const optionalString = z.string().optional().default("");

export const bybitPointRecordSchema = z
  .object({
    pan4: z.string(),
    point: z.coerce.number().optional().default(0),
    side: optionalString,
    type: optionalString,
    subType: optionalString,
    createTime: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional()
      .default(""),
    updateTime: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional()
      .default(""),
    transactionDate: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional()
      .default(""),
    bizId: optionalString,
    bizTxnId: optionalString,
    outOrderId: optionalString,
    transactionId: optionalString,
    transactionAmount: optionalString,
    basicCurrency: optionalString,
    merchCategoryDesc: optionalString,
    merchName: optionalString,
    merchCountry: optionalString,
    merchCity: optionalString,
    payFiatAmount: optionalString,
    transactionCurrencyAmount: optionalString,
  })
  .passthrough();

export type BybitPointRecordInput = z.input<typeof bybitPointRecordSchema>;
export type BybitPointRecordOutput = z.output<typeof bybitPointRecordSchema>;

// ── Result page schema ───────────────────────────────────────────────────────
//
// Bybit returns: { data: [...], totalCount: N, pageSize: N, pageNo: N }.
// All four fields can be absent when the page is empty — default to safe values.

export const bybitPointRecordsPageSchema = z
  .object({
    data: z.array(bybitPointRecordSchema).optional().default([]),
    totalCount: coercedNumber.optional().default(0),
    pageSize: coercedNumber.optional().default(0),
    pageNo: coercedNumber.optional().default(0),
  })
  .strip();

// ── Envelope schema + error throwing ────────────────────────────────────────

function makeEnvelopeSchema<T extends z.ZodTypeAny>(resultSchema: T) {
  return z
    .object({
      retCode: z.number(),
      retMsg: z.string(),
      result: resultSchema,
      retExtInfo: z.record(z.string(), z.unknown()).optional().default({}),
      time: z.number().optional(),
    })
    .strip()
    .transform((data) => {
      if (data.retCode !== 0) {
        throw new BybitApiError({
          retCode: data.retCode,
          retMsg: data.retMsg,
          class: classifyRetCode(data.retCode),
        });
      }
      return data;
    });
}

export const bybitPointsRecordsEnvelopeSchema = makeEnvelopeSchema(
  bybitPointRecordsPageSchema,
);

// ── Card asset record schema ─────────────────────────────────────────────────
//
// Schema for /v5/card/transaction/query-asset-records rows.
// This is the live replacement for the defunct /v5/card/reward/points/records.
// status: "0"=Pending, "1"=Cleared, "2"=Declined.
// txnCreate is a ms-epoch STRING (not a number).

export const bybitCardAssetRecordSchema = z
  .object({
    pan4: z.string().optional().default(""),
    pan6: z.string().optional().default(""),
    tradeStatus: z.string().optional().default(""),
    side: z.string().optional().default(""),
    basicAmount: z.string().optional().default(""),
    basicCurrency: z.string().optional().default(""),
    transactionAmount: z.string().optional().default(""),
    transactionCurrency: z.string().optional().default(""),
    txnCreate: z.union([z.string(), z.number()]).transform(String).optional().default(""),
    merchCountry: z.string().optional().default(""),
    merchCity: z.string().optional().default(""),
    merchName: z.string().optional().default(""),
    txnId: z.string().optional().default(""),
    declinedReason: z.string().optional().default(""),
    totalFees: z.string().optional().default(""),
    foreignTransactionFee: z.string().optional().default(""),
    billAmount: z.string().optional().default(""),
    paidAmount: z.string().optional().default(""),
    paidCurrency: z.string().optional().default(""),
    status: z.string().optional().default(""),
    orderNo: z.string().optional().default(""),
    mccCode: z.string().optional().default(""),
    merchCategoryDesc: z.string().optional().default(""),
  })
  .passthrough();

const bybitCardAssetRecordsPageSchema = z
  .object({
    data: z.array(bybitCardAssetRecordSchema).optional().default([]),
    totalCount: coercedNumber.optional().default(0),
    pageSize: coercedNumber.optional().default(0),
    pageNo: coercedNumber.optional().default(0),
  })
  .strip();

export const bybitCardAssetRecordsEnvelopeSchema = makeEnvelopeSchema(
  bybitCardAssetRecordsPageSchema,
);

// ── Wallet balance (UTA) schema ──────────────────────────────────────────────
//
// Schema for /v5/account/wallet-balance?accountType=UNIFIED.
// Only list[].totalEquity is load-bearing for Phase 1 balance aggregation.

const bybitUnifiedCoinSchema = z
  .object({
    coin: optionalString,
    equity: optionalString,
    usdValue: optionalString,
    walletBalance: optionalString,
    availableToWithdraw: optionalString,
  })
  .passthrough();

const bybitUnifiedAccountSchema = z
  .object({
    accountType: optionalString,
    totalEquity: optionalString,
    totalAvailableBalance: optionalString,
    totalWalletBalance: optionalString,
    coin: z.array(bybitUnifiedCoinSchema).optional().default([]),
  })
  .passthrough();

const bybitWalletBalanceResultSchema = z
  .object({
    list: z.array(bybitUnifiedAccountSchema).optional().default([]),
  })
  .passthrough();

export const bybitWalletBalanceUnifiedSchema = makeEnvelopeSchema(
  bybitWalletBalanceResultSchema,
);

// ── FUND account coins balance schema ────────────────────────────────────────
//
// Schema for /v5/asset/transfer/query-account-coins-balance?accountType=FUND.
// Uses walletBalance per coin.

const bybitFundCoinSchema = z
  .object({
    coin: optionalString,
    transferBalance: optionalString,
    walletBalance: optionalString,
    bonus: optionalString,
  })
  .passthrough();

const bybitFundBalanceResultSchema = z
  .object({
    memberId: optionalString,
    accountType: optionalString,
    balance: z.array(bybitFundCoinSchema).optional().default([]),
  })
  .passthrough();

export const bybitFundBalanceSchema = makeEnvelopeSchema(
  bybitFundBalanceResultSchema,
);

// ── Earn position schema ──────────────────────────────────────────────────────
//
// Schema for /v5/earn/position?category=FlexibleSaving|OnChain.
// Uses amount per position entry.

const bybitEarnPositionItemSchema = z
  .object({
    coin: optionalString,
    productId: optionalString,
    amount: optionalString,
  })
  .passthrough();

const bybitEarnPositionResultSchema = z
  .object({
    list: z.array(bybitEarnPositionItemSchema).optional().default([]),
  })
  .passthrough();

export const bybitEarnPositionSchema = makeEnvelopeSchema(
  bybitEarnPositionResultSchema,
);

// ── Deposit record schema ────────────────────────────────────────────────────
//
// Schema for /v5/asset/deposit/query-record rows.
// status is an integer; 3 = success (terminal). Other fields are strings.

export const bybitDepositRecordSchema = z
  .object({
    coin: z.string().optional().default(""),
    chain: z.string().optional().default(""),
    amount: z.string().optional().default(""),
    txID: z.string().optional().default(""),
    status: z.coerce.number().optional().default(0),
    toAddress: z.string().optional().default(""),
    tag: z.string().optional().default(""),
    depositFee: z.string().optional().default(""),
    successAt: z.union([z.string(), z.number()]).transform(String).optional().default(""),
    confirmations: z.string().optional().default(""),
    txIndex: z.string().optional().default(""),
    blockHash: z.string().optional().default(""),
    fromAddress: z.string().optional().default(""),
    depositType: z.string().optional().default(""),
  })
  .passthrough();

const bybitDepositRecordsResultSchema = z
  .object({
    rows: z.array(bybitDepositRecordSchema).optional().default([]),
    nextPageCursor: z.string().nullable().optional(),
  })
  .passthrough();

export const bybitDepositRecordsEnvelopeSchema = makeEnvelopeSchema(
  bybitDepositRecordsResultSchema,
);

// ── Withdrawal record schema ──────────────────────────────────────────────────
//
// Schema for /v5/asset/withdraw/query-record rows.
// status is a string; "success" = terminal success.

export const bybitWithdrawRecordSchema = z
  .object({
    coin: z.string().optional().default(""),
    chain: z.string().optional().default(""),
    amount: z.string().optional().default(""),
    txID: z.string().optional().default(""),
    status: z.string().optional().default(""),
    toAddress: z.string().optional().default(""),
    tag: z.string().optional().default(""),
    withdrawFee: z.string().optional().default(""),
    createTime: z.union([z.string(), z.number()]).transform(String).optional().default(""),
    updateTime: z.union([z.string(), z.number()]).transform(String).optional().default(""),
    withdrawId: z.string().optional().default(""),
    withdrawType: z.coerce.number().optional().default(0),
  })
  .passthrough();

const bybitWithdrawRecordsResultSchema = z
  .object({
    rows: z.array(bybitWithdrawRecordSchema).optional().default([]),
    nextPageCursor: z.string().nullable().optional(),
  })
  .passthrough();

export const bybitWithdrawRecordsEnvelopeSchema = makeEnvelopeSchema(
  bybitWithdrawRecordsResultSchema,
);

// ── Internal transfer list schema ─────────────────────────────────────────────
//
// Schema for /v5/asset/transfer/query-inter-transfer-list rows.
// Uses "list" not "rows". status is a string; "SUCCESS" = success.

export const bybitInternalTransferRecordSchema = z
  .object({
    transferId: z.string().optional().default(""),
    coin: z.string().optional().default(""),
    amount: z.string().optional().default(""),
    fromAccountType: z.string().optional().default(""),
    toAccountType: z.string().optional().default(""),
    timestamp: z.union([z.string(), z.number()]).transform(String).optional().default(""),
    status: z.string().optional().default(""),
  })
  .passthrough();

const bybitInternalTransferListResultSchema = z
  .object({
    list: z.array(bybitInternalTransferRecordSchema).optional().default([]),
    nextPageCursor: z.string().nullable().optional(),
  })
  .passthrough();

export const bybitInternalTransferListEnvelopeSchema = makeEnvelopeSchema(
  bybitInternalTransferListResultSchema,
);

// ── P2P order schemas ─────────────────────────────────────────────────────────
//
// Schema for /v5/p2p/order/simplifyList items.
// P2P responses have NO top-level retCode — use bybitP2pOrderListEnvelopeSchema
// (non-throwing) paired with skipRetCodeGate:true in bybitFetch.

export const bybitP2pOrderItemSchema = z
  .object({
    id: z.string(),
    side: z.coerce.number(),
    tokenId: z.string().optional().default(""),
    notifyTokenId: z.string().optional().default(""),
    amount: z.string().optional().default(""),
    currencyId: z.string().optional().default(""),
    price: z.string().optional().default(""),
    notifyTokenQuantity: z.string().optional().default(""),
    targetNickName: z.string().optional(),
    sellerRealName: z.string().optional(),
    status: z.coerce.number(),
    createDate: z.union([z.string(), z.number()]).transform(String),
  })
  .passthrough();

const bybitP2pOrderListResultSchema = z
  .object({
    count: z.coerce.number().optional().default(0),
    items: z.array(bybitP2pOrderItemSchema).optional().default([]),
  })
  .passthrough();

export const bybitP2pOrderListEnvelopeSchema = z
  .object({
    result: bybitP2pOrderListResultSchema,
    retCode: z.number().optional(),
    retMsg: z.string().optional(),
  })
  .passthrough();

export type BybitP2pOrderItemOutput = z.output<typeof bybitP2pOrderItemSchema>;

export const bybitServerTimeSchema = z
  .object({
    retCode: z.number(),
    retMsg: z.string(),
    result: z
      .object({
        timeSecond: z.string(),
        timeNano: z.string(),
      })
      .strip(),
  })
  .strip()
  .transform((data) => {
    if (data.retCode !== 0) {
      throw new BybitApiError({
        retCode: data.retCode,
        retMsg: data.retMsg,
        class: classifyRetCode(data.retCode),
      });
    }
    return data;
  });

// ── retCode → error class mapping ────────────────────────────────────────────

import type { BybitErrorClass } from "./types";

export function classifyRetCode(retCode: number): BybitErrorClass {
  if (retCode === 10002) return "timestamp_drift";
  if (retCode === 10003 || retCode === 10004) return "auth_failed";
  if (retCode === 10005) return "sign_invalid";
  if (retCode === 10006) return "rate_limit";
  return "unknown";
}
