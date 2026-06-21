import { describe, it, expect } from "vitest";
import { findDuplicates } from "@/lib/import/dedupe";
import type { ExistingTransaction } from "@/lib/import/dedupe";
import type { ImportRow } from "@/lib/import/types";

function makeRow(overrides: Partial<ImportRow> & { amount: string; occurredAt: string }): ImportRow {
  return {
    currencyCode: "RUB",
    kind: "EXPENSE",
    direction: "out",
    raw: {},
    ...overrides,
  };
}

function makeExisting(overrides: Partial<ExistingTransaction> & { amount: string; occurredAt: Date }): ExistingTransaction {
  return {
    accountId: "acc1",
    ...overrides,
  };
}

describe("findDuplicates", () => {
  const ACC = "acc1";

  it("returns empty set for empty inputs", () => {
    const result = findDuplicates([], [], ACC);
    expect(result.size).toBe(0);
  });

  it("detects exact externalId match", () => {
    const rows = [
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:00:00.000Z", externalId: "tinkoff:abc:123" }),
    ];
    const existing = [
      makeExisting({ amount: "100.00", occurredAt: new Date("2024-06-15T12:00:00.000Z"), externalId: "tinkoff:abc:123" }),
    ];
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(true);
  });

  it("does not flag rows with different externalId AND different amount (no fuzzy match either)", () => {
    // Different externalId AND different amount → neither externalId nor fuzzy check fires
    const rows = [
      makeRow({ amount: "200.00", occurredAt: "2024-06-15T12:00:00.000Z", externalId: "tinkoff:abc:999" }),
    ];
    const existing = [
      makeExisting({ amount: "100.00", occurredAt: new Date("2024-06-15T12:00:00.000Z"), externalId: "tinkoff:abc:123" }),
    ];
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(false);
  });

  it("flags row even with different externalId if amount+timestamp fuzzy-matches (externalId check skipped, fuzzy fires)", () => {
    // SUSPECTED BUG: A row with a different externalId is still flagged as duplicate
    // when amount+timestamp match via fuzzy. The externalId mismatch does NOT protect
    // the row — only the externalId match is checked first; if no externalId match,
    // fuzzy is also evaluated. Both checks are OR'd, not XOR'd.
    // This means: different externalId + same amount/time → still marked duplicate.
    // Actual behavior is documented here as-is.
    const rows = [
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:00:00.000Z", externalId: "tinkoff:abc:999" }),
    ];
    const existing = [
      makeExisting({ amount: "100.00", occurredAt: new Date("2024-06-15T12:00:00.000Z"), externalId: "tinkoff:abc:123" }),
    ];
    const result = findDuplicates(rows, existing, ACC);
    // Row is flagged because fuzzy (amount+timestamp) still matches
    expect(result.has(0)).toBe(true);
  });

  it("detects fuzzy match: same amount and occurredAt within same minute", () => {
    const rows = [
      makeRow({ amount: "250.00", occurredAt: "2024-06-15T12:00:30.000Z" }),
    ];
    const existing = [
      makeExisting({ amount: "250.00", occurredAt: new Date("2024-06-15T12:00:00.000Z") }),
    ];
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(true);
  });

  it("detects fuzzy match within ±60 second tolerance (adjacent bucket)", () => {
    // Existing at :59 of one minute, row at :01 of next minute → ±60s apart
    const rows = [
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:01:01.000Z" }),
    ];
    const existing = [
      makeExisting({ amount: "100.00", occurredAt: new Date("2024-06-15T12:00:59.000Z") }),
    ];
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(true);
  });

  it("does not flag fuzzy match with different amount", () => {
    const rows = [
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:00:00.000Z" }),
    ];
    const existing = [
      makeExisting({ amount: "200.00", occurredAt: new Date("2024-06-15T12:00:00.000Z") }),
    ];
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(false);
  });

  it("fuzzy key uses the accountId parameter (not existing.accountId) for both existing and row lookups", () => {
    // The dedupe function builds fuzzy keys using the passed-in accountId for ALL existing transactions.
    // This means existing.accountId field is NOT used for fuzzy dedup keying.
    // If the caller passes "acc1", ALL existing transactions get fuzzy keys prefixed "acc1:".
    // Same applies to row lookup. So rows are always compared against the same accountId namespace.
    const rows = [
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:00:00.000Z" }),
    ];
    const existing = [
      makeExisting({ amount: "100.00", occurredAt: new Date("2024-06-15T12:00:00.000Z"), accountId: "acc_other" }),
    ];
    // When called with ACC="acc1", existing gets key "acc1:100.00:bucket"
    // Row also checks "acc1:100.00:bucket" → they match regardless of existing.accountId
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(true);

    // When called with a completely different accountId, existing keys use "acc_x:..."
    // and row checks "acc_x:..." → still match (same namespace)
    const resultX = findDuplicates(rows, existing, "acc_x");
    expect(resultX.has(0)).toBe(true);
  });

  it("handles multiple rows — only flags matching ones", () => {
    const rows = [
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:00:00.000Z", externalId: "ext:1" }),
      makeRow({ amount: "200.00", occurredAt: "2024-06-15T13:00:00.000Z", externalId: "ext:2" }),
      makeRow({ amount: "300.00", occurredAt: "2024-06-15T14:00:00.000Z" }),
    ];
    const existing = [
      makeExisting({ amount: "100.00", occurredAt: new Date("2024-06-15T12:00:00.000Z"), externalId: "ext:1" }),
    ];
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(false);
  });

  it("returns empty set when no existing transactions", () => {
    const rows = [
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:00:00.000Z" }),
    ];
    const result = findDuplicates(rows, [], ACC);
    expect(result.size).toBe(0);
  });

  it("existing without externalId only participates in fuzzy matching", () => {
    const rows = [
      makeRow({ amount: "500.00", occurredAt: "2024-06-15T15:00:00.000Z" }),
    ];
    const existing = [
      makeExisting({ amount: "500.00", occurredAt: new Date("2024-06-15T15:00:00.000Z"), externalId: undefined }),
    ];
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(true);
  });

  it("row without externalId falls through to fuzzy match check", () => {
    const rows = [
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:00:00.000Z" }),
    ];
    const existing = [
      makeExisting({ amount: "100.00", occurredAt: new Date("2024-06-15T12:00:10.000Z"), externalId: "tinkoff:irrelevant" }),
    ];
    // Row has no externalId → skips externalId check → fuzzy match
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(true);
  });

  it("two rows with same externalId both get flagged if existing has same id", () => {
    const rows = [
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:00:00.000Z", externalId: "dup:id" }),
      makeRow({ amount: "100.00", occurredAt: "2024-06-15T12:00:00.000Z", externalId: "dup:id" }),
    ];
    const existing = [
      makeExisting({ amount: "100.00", occurredAt: new Date("2024-06-15T12:00:00.000Z"), externalId: "dup:id" }),
    ];
    const result = findDuplicates(rows, existing, ACC);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(true);
  });
});
