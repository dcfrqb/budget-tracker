import { describe, it, expect } from "vitest";
import { importPreviewInputSchema, importConfirmInputSchema } from "@/lib/validation/import";

const VALID_ROW = {
  occurredAt: "2024-06-15T12:00:00.000Z",
  amount: "100.00",
  currencyCode: "RUB",
  kind: "EXPENSE" as const,
  direction: "out" as const,
  accountId: "acc123",
  raw: { "Дата": "15.06.2024", "Сумма": "-100.00" },
};

describe("importPreviewInputSchema", () => {
  it("accepts a single valid file entry", () => {
    const result = importPreviewInputSchema.safeParse({
      files: [
        {
          filename: "tinkoff.csv",
          accountId: "acc123",
          source: "tinkoff",
          csv: "col1;col2\nval1;val2",
          options: undefined,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty files array", () => {
    const result = importPreviewInputSchema.safeParse({ files: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 files", () => {
    const files = Array.from({ length: 21 }, (_, i) => ({
      filename: `file${i}.csv`,
      accountId: "acc123",
      source: "tinkoff" as const,
      csv: "col\nval",
      options: undefined,
    }));
    expect(importPreviewInputSchema.safeParse({ files }).success).toBe(false);
  });

  it("rejects unknown source type", () => {
    const result = importPreviewInputSchema.safeParse({
      files: [
        {
          filename: "bank.csv",
          accountId: "acc123",
          source: "sberbank",
          csv: "col\nval",
          options: undefined,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts generic source type", () => {
    const result = importPreviewInputSchema.safeParse({
      files: [
        {
          filename: "bank.csv",
          accountId: "acc123",
          source: "generic" as const,
          csv: "col\nval",
          options: undefined,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing accountId in file entry", () => {
    const result = importPreviewInputSchema.safeParse({
      files: [
        {
          filename: "tinkoff.csv",
          accountId: "",
          source: "tinkoff" as const,
          csv: "col\nval",
          options: undefined,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects CSV that exceeds 10MB", () => {
    const bigCsv = "x".repeat(10 * 1024 * 1024 + 1);
    const result = importPreviewInputSchema.safeParse({
      files: [
        {
          filename: "big.csv",
          accountId: "acc123",
          source: "tinkoff" as const,
          csv: bigCsv,
          options: undefined,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("importConfirmInputSchema", () => {
  it("accepts valid rows and includedIndices", () => {
    const result = importConfirmInputSchema.safeParse({
      rows: [VALID_ROW],
      includedIndices: [0],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty rows and empty includedIndices", () => {
    const result = importConfirmInputSchema.safeParse({
      rows: [],
      includedIndices: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects row without required kind", () => {
    const { kind: _omit, ...rowWithoutKind } = VALID_ROW;
    const result = importConfirmInputSchema.safeParse({
      rows: [rowWithoutKind],
      includedIndices: [0],
    });
    expect(result.success).toBe(false);
  });

  it("rejects row with invalid kind value", () => {
    const result = importConfirmInputSchema.safeParse({
      rows: [{ ...VALID_ROW, kind: "LOAN" }],
      includedIndices: [0],
    });
    expect(result.success).toBe(false);
  });

  it("rejects row with invalid direction value", () => {
    const result = importConfirmInputSchema.safeParse({
      rows: [{ ...VALID_ROW, direction: "both" }],
      includedIndices: [0],
    });
    expect(result.success).toBe(false);
  });

  it("rejects row without accountId", () => {
    const { accountId: _omit, ...rowNoAccount } = VALID_ROW;
    const result = importConfirmInputSchema.safeParse({
      rows: [rowNoAccount],
      includedIndices: [0],
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional externalId on row", () => {
    const result = importConfirmInputSchema.safeParse({
      rows: [{ ...VALID_ROW, externalId: "tinkoff:abc:def" }],
      includedIndices: [0],
    });
    expect(result.success).toBe(true);
  });

  it("accepts row with TRANSFER kind and direction in", () => {
    const result = importConfirmInputSchema.safeParse({
      rows: [{ ...VALID_ROW, kind: "TRANSFER", direction: "in" }],
      includedIndices: [0],
    });
    expect(result.success).toBe(true);
  });

  it("rejects includedIndices with negative index", () => {
    const result = importConfirmInputSchema.safeParse({
      rows: [VALID_ROW],
      includedIndices: [-1],
    });
    expect(result.success).toBe(false);
  });

  it("accepts categoryMapping as legacy field", () => {
    const result = importConfirmInputSchema.safeParse({
      rows: [VALID_ROW],
      includedIndices: [0],
      categoryMapping: { "0": "cat123" },
    });
    expect(result.success).toBe(true);
  });
});
