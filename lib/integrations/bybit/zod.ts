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
