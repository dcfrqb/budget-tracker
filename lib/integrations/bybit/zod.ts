import { z } from "zod";
import { BybitApiError } from "./types";

// ── Primitive helpers ────────────────────────────────────────────────────────

const numericString = z.string();
const coercedNumber = z.coerce.number();

// ── Card record row schema ───────────────────────────────────────────────────

export const bybitTradeStatusSchema = z.enum([
  "success",
  "declined",
  "refund",
  "reversal",
]);

export const bybitCardRecordSchema = z
  .object({
    pan4: z.string(),
    tradeStatus: bybitTradeStatusSchema,
    side: z.string(),
    basicAmount: numericString,
    basicCurrency: z.string(),
    transactionAmount: numericString,
    transactionCurrency: z.string(),
    paidAmount: numericString,
    paidCurrency: z.string(),
    txnCreate: numericString,
    merchName: z.string(),
    mccCode: z.string(),
    merchCategoryDesc: z.string(),
    txnId: z.string(),
    orderNo: z.string(),
    declinedReason: z.string(),
    totalFees: numericString,
    bonusAmount: numericString,
    status: z.string(),
  })
  .strip();

export type BybitCardRecordInput = z.input<typeof bybitCardRecordSchema>;
export type BybitCardRecordOutput = z.output<typeof bybitCardRecordSchema>;

// ── Result page schema ───────────────────────────────────────────────────────

export const bybitCardPageSchema = z
  .object({
    rows: z.array(bybitCardRecordSchema),
    count: coercedNumber,
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

export const bybitCardEnvelopeSchema = makeEnvelopeSchema(bybitCardPageSchema);

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
