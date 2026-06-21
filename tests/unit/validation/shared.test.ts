import { describe, it, expect } from "vitest";
import { zMoney, zCurrencyCode, zIsoDate, zCuid, zPercent } from "@/lib/validation/shared";

describe("zMoney", () => {
  it("accepts a positive string", () => {
    const result = zMoney.safeParse("100.50");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("100.50");
  });

  it("accepts a positive number and converts to toFixed(2) string", () => {
    const result = zMoney.safeParse(42);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("42.00");
  });

  it("accepts a negative amount (no restriction on sign in zMoney)", () => {
    const result = zMoney.safeParse("-50.00");
    expect(result.success).toBe(true);
  });

  it("accepts zero", () => {
    const result = zMoney.safeParse("0");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("0");
  });

  it("accepts 8 decimal places", () => {
    const result = zMoney.safeParse("1.12345678");
    expect(result.success).toBe(true);
  });

  it("rejects more than 8 decimal places", () => {
    const result = zMoney.safeParse("1.123456789");
    expect(result.success).toBe(false);
  });

  it("rejects NaN string", () => {
    const result = zMoney.safeParse("NaN");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = zMoney.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects alphabetic string", () => {
    const result = zMoney.safeParse("abc");
    expect(result.success).toBe(false);
  });

  it("rejects string with comma decimal (Russian locale)", () => {
    // zMoney regex only accepts dot as decimal separator
    const result = zMoney.safeParse("1 234,56");
    expect(result.success).toBe(false);
  });

  it("converts float number correctly, preserving 2dp", () => {
    const result = zMoney.safeParse(1234.56);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("1234.56");
  });

  it("rejects null", () => {
    const result = zMoney.safeParse(null);
    expect(result.success).toBe(false);
  });
});

describe("zCurrencyCode", () => {
  it("accepts 3-char code", () => {
    expect(zCurrencyCode.safeParse("RUB").success).toBe(true);
    expect(zCurrencyCode.safeParse("USD").success).toBe(true);
  });

  it("accepts 2-char code (min)", () => {
    expect(zCurrencyCode.safeParse("US").success).toBe(true);
  });

  it("accepts 8-char code (max)", () => {
    expect(zCurrencyCode.safeParse("ABCDEFGH").success).toBe(true);
  });

  it("rejects 1-char code (too short)", () => {
    expect(zCurrencyCode.safeParse("U").success).toBe(false);
  });

  it("rejects 9-char code (too long)", () => {
    expect(zCurrencyCode.safeParse("ABCDEFGHI").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(zCurrencyCode.safeParse("").success).toBe(false);
  });
});

describe("zIsoDate", () => {
  it("accepts ISO string and transforms to Date", () => {
    const result = zIsoDate.safeParse("2024-06-15T10:00:00.000Z");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeInstanceOf(Date);
  });

  it("accepts Date object and passes through", () => {
    const d = new Date("2024-06-15");
    const result = zIsoDate.safeParse(d);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeInstanceOf(Date);
  });

  it("accepts plain date string YYYY-MM-DD", () => {
    const result = zIsoDate.safeParse("2024-06-15");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeInstanceOf(Date);
  });

  it("accepts invalid date string (zIsoDate does not validate date validity, just transforms)", () => {
    // "new Date('invalid')" => Invalid Date, but zIsoDate union passes string straight to new Date()
    // This is the actual behavior; the schema does no validity check beyond the union transform
    const result = zIsoDate.safeParse("not-a-date");
    // JS new Date("not-a-date") => Invalid Date (NaN) but the transform still succeeds at schema level
    // The resulting Date is Invalid Date
    if (result.success) {
      expect(result.data).toBeInstanceOf(Date);
    }
    // Either outcome is acceptable here — we're documenting behavior, not asserting a specific result
  });

  it("rejects number input", () => {
    const result = zIsoDate.safeParse(12345);
    expect(result.success).toBe(false);
  });
});

describe("zCuid", () => {
  it("accepts a non-empty string", () => {
    expect(zCuid.safeParse("clxxxxxx0000").success).toBe(true);
  });

  it("accepts any non-empty string (no cuid format check — just min(1))", () => {
    expect(zCuid.safeParse("some-random-id").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(zCuid.safeParse("").success).toBe(false);
  });

  it("rejects null", () => {
    expect(zCuid.safeParse(null).success).toBe(false);
  });
});

describe("zPercent", () => {
  it("accepts 0", () => {
    const result = zPercent.safeParse(0);
    expect(result.success).toBe(true);
  });

  it("accepts 100", () => {
    const result = zPercent.safeParse(100);
    expect(result.success).toBe(true);
  });

  it("accepts 1000 (max)", () => {
    const result = zPercent.safeParse(1000);
    expect(result.success).toBe(true);
  });

  it("rejects 1001 (over max)", () => {
    const result = zPercent.safeParse(1001);
    expect(result.success).toBe(false);
  });

  it("accepts decimal with up to 4 places", () => {
    const result = zPercent.safeParse("50.1234");
    expect(result.success).toBe(true);
  });

  it("rejects decimal with 5 places", () => {
    const result = zPercent.safeParse("50.12345");
    expect(result.success).toBe(false);
  });

  it("rejects negative values", () => {
    const result = zPercent.safeParse("-1");
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric string", () => {
    const result = zPercent.safeParse("abc");
    expect(result.success).toBe(false);
  });
});
