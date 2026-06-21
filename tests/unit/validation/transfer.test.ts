import { describe, it, expect } from "vitest";
import { transferCreateSchema, transferUpdateSchema } from "@/lib/validation/transfer";

const BASE_TRANSFER = {
  fromAccountId: "acc_from",
  toAccountId: "acc_to",
  fromAmount: "1000.00",
  toAmount: "11.50",
  occurredAt: "2024-06-15T12:00:00.000Z",
};

describe("transferCreateSchema", () => {
  it("accepts valid transfer between two accounts", () => {
    const result = transferCreateSchema.safeParse(BASE_TRANSFER);
    expect(result.success).toBe(true);
  });

  it("accepts transfer with optional rate", () => {
    const result = transferCreateSchema.safeParse({
      ...BASE_TRANSFER,
      rate: "88.50",
    });
    expect(result.success).toBe(true);
  });

  it("accepts transfer with optional fee", () => {
    const result = transferCreateSchema.safeParse({
      ...BASE_TRANSFER,
      fee: "5.00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts transfer with note", () => {
    const result = transferCreateSchema.safeParse({
      ...BASE_TRANSFER,
      note: "Currency exchange",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fromAccountId", () => {
    const { fromAccountId: _omit, ...rest } = BASE_TRANSFER;
    expect(transferCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing toAccountId", () => {
    const { toAccountId: _omit, ...rest } = BASE_TRANSFER;
    expect(transferCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing fromAmount", () => {
    const { fromAmount: _omit, ...rest } = BASE_TRANSFER;
    expect(transferCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid amount format", () => {
    const result = transferCreateSchema.safeParse({
      ...BASE_TRANSFER,
      fromAmount: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("rejects note longer than 500 chars", () => {
    const result = transferCreateSchema.safeParse({
      ...BASE_TRANSFER,
      note: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts null fee (nullish)", () => {
    const result = transferCreateSchema.safeParse({
      ...BASE_TRANSFER,
      fee: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("transferUpdateSchema", () => {
  it("accepts empty patch (all fields optional)", () => {
    const result = transferUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial update with just note", () => {
    const result = transferUpdateSchema.safeParse({ note: "Updated note" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with rate only", () => {
    const result = transferUpdateSchema.safeParse({ rate: "90.00" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid fromAmount even in partial update", () => {
    const result = transferUpdateSchema.safeParse({ fromAmount: "bad" });
    expect(result.success).toBe(false);
  });
});
