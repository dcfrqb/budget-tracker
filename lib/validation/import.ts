import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Import validation schemas
// ─────────────────────────────────────────────────────────────

const CSV_MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches original implicit limit

const importRowSchema = z.object({
  externalId: z.string().optional(),
  occurredAt: z.string(),
  amount: z.string(),
  currencyCode: z.string(),
  kind: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  // Phase 4: direction is required. Wizard always sends it.
  direction: z.enum(["in", "out"]),
  cardLast4: z.string().optional(),
  rawCategory: z.string().optional(),
  description: z.string().optional(),
  counterparty: z.string().optional(),
  raw: z.record(z.string(), z.string()),
  // Phase 4: accountId is required per-row (no more top-level accountId).
  accountId: z.string().min(1),
  sourceFile: z.string().optional(),
  // Category selected by the user in the wizard preview step.
  selectedCategoryId: z.string().nullable().optional(),
  pairId: z.string().optional(),
  pairStatus: z
    .enum(["paired-transfer", "intra-account-skipped", "unpaired"])
    .optional(),
  pairWith: z.number().int().nonnegative().optional(),
  included: z.boolean().optional(),
  isDuplicate: z.boolean().optional(),
  suggestedCategoryId: z.string().nullable().optional(),
});

const genericMappingSchema = z.object({
  date: z.string(),
  amount: z.string(),
  currency: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  delimiter: z.string().optional(),
});

const fileOptionsSchema = z
  .object({
    delimiter: z.enum([";", ","]).optional(),
    encoding: z.enum(["utf-8", "windows-1251"]).optional(),
    mapping: genericMappingSchema.optional(),
  })
  .optional();

// ── Multi-file preview input ─────────────────────────────────
export const importPreviewInputSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().min(1).max(240),
        accountId: z.string().min(1),
        source: z.enum(["tinkoff", "generic"]),
        csv: z.string().min(1).max(CSV_MAX_BYTES),
        options: fileOptionsSchema,
      }),
    )
    .min(1)
    .max(20),
});

// ── Confirm input ────────────────────────────────────────────
// Phase 4: top-level accountId dropped. Each row carries its own accountId.
// categoryMapping is still accepted for backward compat but route prefers per-row selectedCategoryId.
export const importConfirmInputSchema = z.object({
  rows: z.array(importRowSchema),
  // Optional legacy categoryMapping: row-index (string) → categoryId | null.
  // Wizard now sends selectedCategoryId on each row directly; this field is ignored
  // if a row has selectedCategoryId set.
  categoryMapping: z.record(z.string(), z.string().nullable()).optional(),
  includedIndices: z.array(z.number().int().nonnegative()),
});

export type ImportPreviewInput = z.infer<typeof importPreviewInputSchema>;
export type ImportConfirmInput = z.infer<typeof importConfirmInputSchema>;
export type ImportRowInput = z.infer<typeof importRowSchema>;
