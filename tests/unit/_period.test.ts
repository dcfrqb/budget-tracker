import { describe, it, expect } from "vitest";
import { mapDefaultPeriod, startOfMonthUtcInTz, periodBounds, addMonths } from "@/lib/data/_period";

// ── mapDefaultPeriod ─────────────────────────────────────────────────────────

describe("mapDefaultPeriod", () => {
  describe("dynamic codes pass through unchanged for all surfaces", () => {
    const dynamics = ["tm", "tq", "ty"] as const;
    for (const code of dynamics) {
      it(`passes ${code} through`, () => {
        expect(mapDefaultPeriod(code, "txn")).toBe(code);
        expect(mapDefaultPeriod(code, "income")).toBe(code);
        expect(mapDefaultPeriod(code, "analytics")).toBe(code);
      });
    }
  });

  describe("txn surface", () => {
    it("maps 30d → 30d", () => expect(mapDefaultPeriod("30d", "txn")).toBe("30d"));
    it("maps 90d → 90d", () => expect(mapDefaultPeriod("90d", "txn")).toBe("90d"));
    it("maps 3m → 90d", () => expect(mapDefaultPeriod("3m", "txn")).toBe("90d"));
    it("maps 6m → 1y", () => expect(mapDefaultPeriod("6m", "txn")).toBe("1y"));
    it("maps 12m → 1y", () => expect(mapDefaultPeriod("12m", "txn")).toBe("1y"));
    it("maps all → 1y", () => expect(mapDefaultPeriod("all", "txn")).toBe("1y"));
    it("falls back to 30d for unknown", () => expect(mapDefaultPeriod("xyz", "txn")).toBe("30d"));
  });

  describe("income surface", () => {
    it("maps 30d → 1m", () => expect(mapDefaultPeriod("30d", "income")).toBe("1m"));
    it("maps 90d → 3m", () => expect(mapDefaultPeriod("90d", "income")).toBe("3m"));
    it("maps 3m → 3m", () => expect(mapDefaultPeriod("3m", "income")).toBe("3m"));
    it("maps 6m → 6m", () => expect(mapDefaultPeriod("6m", "income")).toBe("6m"));
    it("maps 12m → 12m", () => expect(mapDefaultPeriod("12m", "income")).toBe("12m"));
    it("maps all → all", () => expect(mapDefaultPeriod("all", "income")).toBe("all"));
    it("falls back to 3m for unknown", () => expect(mapDefaultPeriod("xyz", "income")).toBe("3m"));
  });

  describe("analytics surface", () => {
    it("maps 30d → 1m", () => expect(mapDefaultPeriod("30d", "analytics")).toBe("1m"));
    it("maps 90d → 3m", () => expect(mapDefaultPeriod("90d", "analytics")).toBe("3m"));
    it("maps 3m → 3m", () => expect(mapDefaultPeriod("3m", "analytics")).toBe("3m"));
    it("maps 6m → 6m", () => expect(mapDefaultPeriod("6m", "analytics")).toBe("6m"));
    it("maps 12m → 12m", () => expect(mapDefaultPeriod("12m", "analytics")).toBe("12m"));
    it("maps all → 12m", () => expect(mapDefaultPeriod("all", "analytics")).toBe("12m"));
    it("falls back to 3m for unknown", () => expect(mapDefaultPeriod("xyz", "analytics")).toBe("3m"));
  });
});

// ── addMonths ────────────────────────────────────────────────────────────────

describe("addMonths", () => {
  it("adds 1 month", () => {
    const d = new Date("2026-06-01T00:00:00Z");
    expect(addMonths(d, 1).toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("rolls over year boundary", () => {
    const d = new Date("2026-12-01T00:00:00Z");
    expect(addMonths(d, 1).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("handles 12 months = same day next year", () => {
    const d = new Date("2026-01-15T00:00:00Z");
    expect(addMonths(d, 12).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("does not mutate the original date", () => {
    const d = new Date("2026-06-01T00:00:00Z");
    addMonths(d, 3);
    expect(d.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("adds 0 months: unchanged", () => {
    const d = new Date("2026-05-15T00:00:00Z");
    expect(addMonths(d, 0).toISOString()).toBe(d.toISOString());
  });
});

// ── startOfMonthUtcInTz ──────────────────────────────────────────────────────

describe("startOfMonthUtcInTz", () => {
  it("UTC: start of June 2026 = 2026-06-01T00:00:00Z", () => {
    const anchor = new Date("2026-06-15T12:00:00Z");
    const result = startOfMonthUtcInTz("UTC", anchor);
    expect(result.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("Moscow UTC+3: anchor mid-June → start = 2026-05-31T21:00:00Z (midnight MSK is UTC-3)", () => {
    const anchor = new Date("2026-06-15T12:00:00Z");
    const result = startOfMonthUtcInTz("Europe/Moscow", anchor);
    // MSK is UTC+3, so midnight June 1 MSK = May 31 21:00 UTC
    expect(result.toISOString()).toBe("2026-05-31T21:00:00.000Z");
  });

  it("LA UTC-8: anchor mid-June → start = 2026-06-01T07:00:00Z (midnight LA in PDT = UTC-7)", () => {
    // In June, LA is PDT = UTC-7, so midnight June 1 local = 07:00 UTC
    const anchor = new Date("2026-06-15T12:00:00Z");
    const result = startOfMonthUtcInTz("America/Los_Angeles", anchor);
    expect(result.toISOString()).toBe("2026-06-01T07:00:00.000Z");
  });

  it("LA UTC-8 in January (PST = UTC-8): midnight Jan 1 local = 08:00 UTC", () => {
    const anchor = new Date("2026-01-15T12:00:00Z");
    const result = startOfMonthUtcInTz("America/Los_Angeles", anchor);
    expect(result.toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });

  it("defaults now to current date (smoke test: returns a Date)", () => {
    const result = startOfMonthUtcInTz("UTC");
    expect(result).toBeInstanceOf(Date);
    expect(result.getUTCDate()).toBe(1);
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
  });
});

// ── periodBounds ─────────────────────────────────────────────────────────────

describe("periodBounds", () => {
  const now = new Date("2026-06-21T12:00:00Z");

  it("all: from epoch to now", () => {
    const { from, to } = periodBounds("all", "UTC", now);
    expect(from.getTime()).toBe(0);
    expect(to.getTime()).toBe(now.getTime());
  });

  it("1m: from start of current month to now", () => {
    const { from, to } = periodBounds("1m", "UTC", now);
    expect(from.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(to.getTime()).toBe(now.getTime());
  });

  it("3m: from start of month 3 months ago (April) to now", () => {
    // 3m: pivot = now - 2 months = April 2026, start of April
    const { from, to } = periodBounds("3m", "UTC", now);
    expect(from.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(to.getTime()).toBe(now.getTime());
  });

  it("6m: from 6 months ago (January) to now", () => {
    const { from, to } = periodBounds("6m", "UTC", now);
    expect(from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(to.getTime()).toBe(now.getTime());
  });

  it("12m: from 12 months ago (July 2025) to now", () => {
    const { from, to } = periodBounds("12m", "UTC", now);
    expect(from.toISOString()).toBe("2025-07-01T00:00:00.000Z");
    expect(to.getTime()).toBe(now.getTime());
  });

  it("LA tz: 3m from current date in LA offset", () => {
    const { from } = periodBounds("3m", "America/Los_Angeles", now);
    // PDT (UTC-7): April 1 00:00 LA = April 1 07:00 UTC
    expect(from.toISOString()).toBe("2026-04-01T07:00:00.000Z");
  });

  it("Moscow tz: 3m accounts for +3 offset", () => {
    const { from } = periodBounds("3m", "Europe/Moscow", now);
    // MSK (UTC+3): April 1 00:00 MSK = March 31 21:00 UTC
    expect(from.toISOString()).toBe("2026-03-31T21:00:00.000Z");
  });

  // DST boundary test: LA transitions in March (spring forward) and November (fall back)
  // Using a December anchor to check November-based boundary
  it("DST boundary in LA: anchor in December, 1m gives November start (PDT→PST transition)", () => {
    // 2026-12-15 in LA; 1m: pivot = Dec, start of December in PST (UTC-8)
    const decNow = new Date("2026-12-15T12:00:00Z");
    const { from } = periodBounds("1m", "America/Los_Angeles", decNow);
    // PST = UTC-8: Dec 1 00:00 LA = Dec 1 08:00 UTC
    expect(from.toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });

  it("DST boundary in LA: anchor in April, 3m covers March (spring-forward)", () => {
    // 2026-04-15; 3m: pivot = February, from = start of February in PST (UTC-8)
    const aprNow = new Date("2026-04-15T12:00:00Z");
    const { from } = periodBounds("3m", "America/Los_Angeles", aprNow);
    // February is PST (UTC-8): Feb 1 00:00 LA = Feb 1 08:00 UTC
    expect(from.toISOString()).toBe("2026-02-01T08:00:00.000Z");
  });
});
