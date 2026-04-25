import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Import validation schemas
// ─────────────────────────────────────────────────────────────

const importRowSchema = z.object({
  externalId: z.string().optional(),
  occurredAt: z.string(),
  amount: z.string(),
  currencyCode: z.string(),
  kind: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  rawCategory: z.string().optional(),
  description: z.string().optional(),
  counterparty: z.string().optional(),
  raw: z.record(z.string(), z.string()),
});

const genericMappingSchema = z.object({
  date: z.string(),
  amount: z.string(),
  currency: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  delimiter: z.string().optional(),
});

export const importPreviewInputSchema = z.object({
  accountId: z.string().min(1),
  source: z.enum(["tinkoff", "generic"]),
  csv: z.string().min(1),
  options: z
    .object({
      delimiter: z.enum([";", ","]).optional(),
      encoding: z.enum(["utf-8", "windows-1251"]).optional(),
      mapping: genericMappingSchema.optional(),
    })
    .optional(),
});

export const importConfirmInputSchema = z.object({
  accountId: z.string().min(1),
  rows: z.array(importRowSchema),
  categoryMapping: z.record(z.string(), z.string().nullable()),
  includedIndices: z.array(z.number().int().nonnegative()),
});

export type ImportPreviewInput = z.infer<typeof importPreviewInputSchema>;
export type ImportConfirmInput = z.infer<typeof importConfirmInputSchema>;
export type ImportRowInput = z.infer<typeof importRowSchema>;
