import { describe, it, expect } from "vitest";
import { normalizeMerchant, merchantSimilarity } from "@/lib/integrations/merchant";

// ── normalizeMerchant ────────────────────────────────────────────────────────

describe("normalizeMerchant", () => {
  it("handles empty / blank strings", () => {
    expect(normalizeMerchant("")).toBe("");
    expect(normalizeMerchant("   ")).toBe("");
  });

  it("OPENAI *CHATGPT SUBSCR → openai chatgpt", () => {
    expect(normalizeMerchant("OPENAI *CHATGPT SUBSCR")).toBe("openai chatgpt");
  });

  it("HOSTVDS.COM → hostvds", () => {
    expect(normalizeMerchant("HOSTVDS.COM")).toBe("hostvds");
  });

  it("PADDLE.NET* IHUNTER → ihunter", () => {
    expect(normalizeMerchant("PADDLE.NET* IHUNTER")).toBe("ihunter");
  });

  it("NETFLIX.COM → netflix", () => {
    expect(normalizeMerchant("NETFLIX.COM")).toBe("netflix");
  });

  it("ANTHROPIC → anthropic", () => {
    expect(normalizeMerchant("ANTHROPIC")).toBe("anthropic");
  });

  it("Google YouTubePremium → google youtubepremium", () => {
    expect(normalizeMerchant("Google YouTubePremium")).toBe("google youtubepremium");
  });

  it("YM*4vps — strips star prefix pattern", () => {
    // "YM*" is NOT in PROCESSOR_PREFIX_RE, so * is just collapsed to space
    const result = normalizeMerchant("YM*4vps");
    expect(result).toBe("ym 4vps");
  });

  it("Cyrillic: еТелеком — SUSPECTED BUG: Cyrillic chars stripped to empty string", () => {
    // NON_ALNUM_RE = /[^a-z0-9\s]/g strips all non-ASCII characters including Cyrillic.
    // SUSPECTED BUG: Cyrillic merchant names are fully erased, making matching impossible.
    // Actual behavior: returns "" (empty).
    const result = normalizeMerchant("еТелеком");
    // Documenting actual (buggy) behavior:
    expect(result).toBe("");
    // What it SHOULD return (if fixed): something like "телеком" (lowercased Cyrillic)
  });

  it("strips billing words: subscription, payment, recurring, monthly, billing, inc, ltd, llc", () => {
    expect(normalizeMerchant("Acme Inc")).toBe("acme");
    expect(normalizeMerchant("SomeService LLC")).toBe("someservice");
    expect(normalizeMerchant("PayCorp Ltd")).toBe("paycorp");
    expect(normalizeMerchant("WIDGET MONTHLY")).toBe("widget");
  });

  it("strips TLD suffixes .io, .ai, .app", () => {
    expect(normalizeMerchant("cursor.io")).toBe("cursor");
    expect(normalizeMerchant("OPENAI.COM")).toBe("openai");
    expect(normalizeMerchant("some.app")).toBe("some");
  });

  it("collapses multiple spaces", () => {
    // multiple spaces from stripping should collapse
    const result = normalizeMerchant("FOO   BAR   BAZ");
    expect(result).toBe("foo bar baz");
  });

  it("PAYPAL * Acme → acme", () => {
    expect(normalizeMerchant("PAYPAL * Acme")).toBe("acme");
  });
});

// ── merchantSimilarity ───────────────────────────────────────────────────────

describe("merchantSimilarity", () => {
  it("returns 0 for empty strings", () => {
    expect(merchantSimilarity("", "netflix")).toBe(0);
    expect(merchantSimilarity("netflix", "")).toBe(0);
    expect(merchantSimilarity("", "")).toBe(0);
  });

  it("returns 1 for identical strings", () => {
    expect(merchantSimilarity("NETFLIX.COM", "NETFLIX.COM")).toBe(1);
    expect(merchantSimilarity("openai", "openai")).toBe(1);
  });

  it("is symmetric: sim(a,b) === sim(b,a)", () => {
    const pairs = [
      ["OPENAI *CHATGPT SUBSCR", "OpenAI ChatGPT"],
      ["HOSTVDS.COM", "hostvds"],
      ["NETFLIX.COM", "amazon.com"],
      ["Google YouTubePremium", "YouTube Premium"],
    ] as const;

    for (const [a, b] of pairs) {
      const ab = merchantSimilarity(a, b);
      const ba = merchantSimilarity(b, a);
      expect(ab).toBeCloseTo(ba, 10);
    }
  });

  it("unrelated merchants score low (< 0.2)", () => {
    const score = merchantSimilarity("NETFLIX.COM", "HOSTVDS.COM");
    expect(score).toBeLessThan(0.2);
  });

  it("same merchant different casing scores high (= 1)", () => {
    const score = merchantSimilarity("hostvds", "HOSTVDS.COM");
    expect(score).toBe(1);
  });

  it("OPENAI *CHATGPT SUBSCR vs OpenAI ChatGPT: score > 0.5", () => {
    const score = merchantSimilarity("OPENAI *CHATGPT SUBSCR", "OpenAI ChatGPT");
    expect(score).toBeGreaterThan(0.5);
  });

  it("result is in [0, 1]", () => {
    const pairs = [
      ["foo", "bar"],
      ["Netflix", "NETFLIX.COM"],
      ["PADDLE.NET* IHUNTER", "iHunter"],
    ];
    for (const [a, b] of pairs) {
      const s = merchantSimilarity(a, b);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("Cyrillic: еТелеком similarity to itself = 0 (SUSPECTED BUG: Cyrillic stripped to empty)", () => {
    // normalizeMerchant("еТелеком") = "" (all Cyrillic stripped by NON_ALNUM_RE)
    // merchantSimilarity returns 0 when either normalized string is empty.
    // SUSPECTED BUG: same as normalizeMerchant Cyrillic issue above.
    expect(merchantSimilarity("еТелеком", "еТелеком")).toBe(0);
  });

  it("Cyrillic: еТелеком vs latin telecom: low score", () => {
    // After normalization, Cyrillic remains Cyrillic, Latin remains Latin; Jaccard = 0
    const score = merchantSimilarity("еТелеком", "telecom");
    expect(score).toBe(0);
  });
});
