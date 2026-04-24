// ─────────────────────────────────────────────────────────────
// One-liner parser — pure function, no Prisma / fetch / DOM.
// ─────────────────────────────────────────────────────────────

import type { Locale } from "@/lib/i18n/types";
import {
  INCOME_TRIGGERS,
  CATEGORY_LEXICON,
  CURRENCY_SYMBOLS,
  RE_ISO_DATE,
  RE_DDMM,
  RE_DAY_OF_MONTH,
  RU_WEEKDAYS,
  EN_WEEKDAYS,
  TODAY_TRIGGERS,
  YESTERDAY_TRIGGERS,
  DAY_BEFORE_YESTERDAY_TRIGGERS,
  WEEKDAY_PREPOSITIONS,
} from "./one-liner-lexicon";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ParseWarning =
  | "no_category"
  | "multiple_amounts"
  | "currency_mismatch"
  | "category_kind_mismatch";

export interface ParseContext {
  /** ISO currency code of the account (e.g. "RUB") */
  accountCurrency?: string;
  /** Today's date reference for relative dates */
  now?: Date;
  /** Locale used for formatting preview dates */
  locale?: Locale;
  /** Categories to match against */
  categories?: Array<{ id: string; name: string; kind: "INCOME" | "EXPENSE" }>;
}

export interface ParsedTransaction {
  /** Formatted amount string (decimal, positive) e.g. "1500.00" */
  amount: string;
  /** ISO currency code */
  currencyCode: string;
  /** INCOME or EXPENSE */
  kind: "INCOME" | "EXPENSE";
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Human-readable date for preview (formatted by locale) */
  dateLabel: string;
  /** Canonical category name matched, or null */
  categoryGuess: string | null;
  /** Category id if found in provided categories, or null */
  categoryId: string | null;
  /** Description cleaned of parsed tokens */
  description: string;
  /** Original raw input */
  raw: string;
  /** 0.0 – 1.0 confidence */
  confidence: number;
  /** Warnings */
  warnings: ParseWarning[];
}

export type ParseError =
  | { error: "empty" }
  | { error: "no_amount" };

// ─────────────────────────────────────────────────────────────
// Amount regex
// Matches: 1500, 1,500, 1.500, 1500.50, 1 500, 12,50 (RU decimal)
// Also: 1.5k, 1.5к, 15к, 15k
// Does NOT match negative numbers.
// ─────────────────────────────────────────────────────────────

const RE_AMOUNT =
  /\b(\d[\d\s]*(?:[.,]\d+)?(?:[.,]\d+)?)\s*([кk])\b|\b(\d{1,3}(?:\s\d{3})*(?:[.,]\d{1,2})?)\b|\b(\d+(?:[.,]\d+)?)\b/gi;

// Simpler extraction: match a numeric value with optional decimal and k-suffix
const RE_AMOUNT_EXTRACT =
  /\b(\d[\d\s]*)(?:[.,](\d+))?(?:\s*([кkKК]))\b|\b(\d[\d\s]*)(?:[.,](\d+))?\b/gi;

/**
 * Parse a monetary amount string into a float.
 * Handles: 1500, "1 500", "1,500" (EN grouping), "12,50" (RU decimal), "1.5k", "1.5к"
 */
function parseAmount(raw: string): number | null {
  // Strip internal spaces used as thousands separators
  let s = raw.replace(/\s/g, "");

  // Handle k/к suffix
  const kMatch = s.match(/^([\d.,]+)[кkKК]$/i);
  if (kMatch) {
    const base = parseFloat(kMatch[1].replace(",", "."));
    return isNaN(base) ? null : base * 1000;
  }

  // Determine if comma is decimal separator (RU) or thousands (EN).
  // RU: "12,50" — comma followed by exactly 2 digits at end
  // EN: "1,500" — comma followed by 3 digits (thousands)
  if (s.includes(",") && !s.includes(".")) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // RU decimal: "12,50" → "12.50"
      s = parts[0] + "." + parts[1];
    } else {
      // EN thousands: "1,500" → "1500"
      s = s.replace(/,/g, "");
    }
  }

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────────────────────
// Currency extraction
// ─────────────────────────────────────────────────────────────

/**
 * Find a currency marker in the input string.
 * Returns { code, matchStr } or null.
 */
function extractCurrency(
  text: string,
): { code: string; matchStr: string } | null {
  // Check for symbol-style currencies (₽, $, €, £) — they appear adjacent to numbers
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(sym)) {
      return { code, matchStr: sym };
    }
  }

  // Check for word-style currencies (руб, rub, usd, eur) as separate tokens
  const lc = text.toLowerCase();
  const tokens = lc.split(/[\s,.:;!?()[\]{}]+/);
  for (const tok of tokens) {
    if (CURRENCY_SYMBOLS[tok]) {
      return { code: CURRENCY_SYMBOLS[tok], matchStr: tok };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Date extraction
// ─────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDateLabel(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
  }).format(d);
}

interface DateMatch {
  date: Date;
  matchStr: string;
  explicit: boolean;
}

function extractDate(text: string, now: Date): DateMatch | null {
  const lc = text.toLowerCase();

  // ISO date YYYY-MM-DD
  const isoMatch = text.match(RE_ISO_DATE);
  if (isoMatch) {
    const d = new Date(isoMatch[1] + "T00:00:00");
    if (!isNaN(d.getTime())) {
      return { date: d, matchStr: isoMatch[0], explicit: true };
    }
  }

  // DD.MM or DD.MM.YYYY
  const ddmmMatch = text.match(RE_DDMM);
  if (ddmmMatch) {
    const day = parseInt(ddmmMatch[1], 10);
    const month = parseInt(ddmmMatch[2], 10) - 1;
    const year = ddmmMatch[3]
      ? ddmmMatch[3].length === 2
        ? 2000 + parseInt(ddmmMatch[3], 10)
        : parseInt(ddmmMatch[3], 10)
      : now.getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day) {
      return { date: d, matchStr: ddmmMatch[0], explicit: true };
    }
  }

  // "сегодня" / "today"
  for (const trigger of TODAY_TRIGGERS) {
    if (lc.includes(trigger)) {
      return { date: new Date(now), matchStr: trigger, explicit: true };
    }
  }

  // "вчера" / "yesterday"
  for (const trigger of YESTERDAY_TRIGGERS) {
    if (lc.includes(trigger)) {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return { date: d, matchStr: trigger, explicit: true };
    }
  }

  // "позавчера"
  for (const trigger of DAY_BEFORE_YESTERDAY_TRIGGERS) {
    if (lc.includes(trigger)) {
      const d = new Date(now);
      d.setDate(d.getDate() - 2);
      return { date: d, matchStr: trigger, explicit: true };
    }
  }

  // "N числа" / "N-го" / "Nth"
  const dayMatch = lc.match(RE_DAY_OF_MONTH);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      if (!isNaN(d.getTime()) && d.getDate() === day) {
        return { date: d, matchStr: dayMatch[0], explicit: true };
      }
    }
  }

  // Weekday: "в понедельник" / "on monday"
  const tokens = lc.split(/[\s,.:;!?]+/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    // skip prepositions
    if (WEEKDAY_PREPOSITIONS.has(tok)) continue;

    let targetDay: number | undefined;
    if (tok in RU_WEEKDAYS) targetDay = RU_WEEKDAYS[tok];
    else if (tok in EN_WEEKDAYS) targetDay = EN_WEEKDAYS[tok];

    if (targetDay !== undefined) {
      const d = new Date(now);
      const currentDay = d.getDay();
      let diff = targetDay - currentDay;
      if (diff >= 0) diff -= 7; // go to last occurrence
      d.setDate(d.getDate() + diff);
      return { date: d, matchStr: tok, explicit: true };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Kind detection
// ─────────────────────────────────────────────────────────────

function detectKind(text: string): "INCOME" | "EXPENSE" {
  const lc = text.toLowerCase();
  const tokens = lc.split(/[\s,.:;!?()[\]{}]+/);
  for (const tok of tokens) {
    if (INCOME_TRIGGERS.has(tok)) return "INCOME";
  }
  return "EXPENSE";
}

// ─────────────────────────────────────────────────────────────
// Category matching
// ─────────────────────────────────────────────────────────────

function matchCategory(
  text: string,
  kind: "INCOME" | "EXPENSE",
  categories?: Array<{ id: string; name: string; kind: "INCOME" | "EXPENSE" }>,
): { name: string; id: string | null; mismatch: boolean } | null {
  const lc = text.toLowerCase();

  let bestName: string | null = null;
  let bestScore = 0;

  for (const [canonicalName, triggers] of Object.entries(CATEGORY_LEXICON)) {
    for (const trigger of triggers) {
      if (lc.includes(trigger)) {
        // Prefer longer trigger match for better precision
        if (trigger.length > bestScore) {
          bestScore = trigger.length;
          bestName = canonicalName;
        }
      }
    }
  }

  if (!bestName) return null;

  // Find in provided categories
  let catId: string | null = null;
  let mismatch = false;

  if (categories) {
    const found = categories.find(
      (c) => c.name === bestName,
    );
    if (found) {
      catId = found.id;
      mismatch = found.kind !== kind;
    } else {
      // Category name matched but not in DB list — check if any cat with that name exists regardless of kind
      mismatch = false;
    }
  }

  return { name: bestName, id: catId, mismatch };
}

// ─────────────────────────────────────────────────────────────
// Amount finder — returns all amounts found in text
// ─────────────────────────────────────────────────────────────

interface AmountToken {
  value: number;
  raw: string; // full matched text to strip
  currencyCode?: string;
}

function findAmounts(text: string): AmountToken[] {
  const results: AmountToken[] = [];
  // Match pattern: optional currency before, number (with optional decimal + k), optional currency after
  // We match: ₽1500 | 1500₽ | 1500 руб | 1.5k | 1500,50
  const re =
    /([₽$€£])\s*(\d[\d\s]*(?:[.,]\d+)?\s*[кkKК]?)\b|\b(\d[\d\s]*(?:[.,]\d+)?\s*[кkKК]?)\s*([₽$€£]|руб|rub|usd|eur|gbp)?/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<number>();
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    // m[1] = leading currency symbol, m[2] = number after symbol
    // m[3] = number without leading symbol, m[4] = trailing currency marker
    const rawNum = (m[2] || m[3] || "").trim();
    if (!rawNum) continue;
    const val = parseAmount(rawNum);
    if (val === null || val <= 0) continue;
    // Deduplicate by position
    const pos = m.index;
    if (seen.has(pos)) continue;
    seen.add(pos);

    let currencyCode: string | undefined;
    const symBefore = m[1];
    const symAfter = m[4];
    if (symBefore) currencyCode = CURRENCY_SYMBOLS[symBefore];
    else if (symAfter) {
      currencyCode =
        CURRENCY_SYMBOLS[symAfter] || CURRENCY_SYMBOLS[symAfter.toLowerCase()];
    }

    results.push({ value: val, raw: m[0], currencyCode });
  }
  return results;
}

// ─────────────────────────────────────────────────────────────
// Strip matched tokens from description
// ─────────────────────────────────────────────────────────────

function stripTokens(text: string, toRemove: string[]): string {
  let result = text;
  for (const tok of toRemove) {
    // Escape for regex
    const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "gi"), " ");
  }
  // Collapse whitespace
  return result.replace(/\s{2,}/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────

export function parseOneLiner(
  rawInput: string,
  ctx: ParseContext = {},
): ParsedTransaction | ParseError {
  const text = rawInput.trim();

  if (!text) return { error: "empty" };

  const now = ctx.now ?? new Date();
  const locale = ctx.locale ?? "ru";
  const accountCurrency = ctx.accountCurrency ?? "RUB";
  const categories = ctx.categories;

  const warnings: ParseWarning[] = [];
  const strippedTokens: string[] = [];

  // 1. Find all amounts
  const amounts = findAmounts(text);
  if (amounts.length === 0) return { error: "no_amount" };
  if (amounts.length > 1) warnings.push("multiple_amounts");

  const primaryAmount = amounts[0];
  strippedTokens.push(primaryAmount.raw);

  // Format amount as decimal string
  const amountStr = primaryAmount.value.toFixed(2);

  // 2. Determine currency
  let currencyCode = primaryAmount.currencyCode ?? accountCurrency;

  // Also look for standalone currency markers not attached to the amount
  const standaloneCC = extractCurrency(text);
  if (standaloneCC && !primaryAmount.currencyCode) {
    currencyCode = standaloneCC.code;
    strippedTokens.push(standaloneCC.matchStr);
  }

  if (currencyCode !== accountCurrency) {
    warnings.push("currency_mismatch");
  }

  // 3. Detect kind
  const kind = detectKind(text);

  // Strip income trigger words from description tokens
  const lc = text.toLowerCase();
  const tokens = lc.split(/[\s,.:;!?()[\]{}]+/);
  for (const tok of tokens) {
    if (INCOME_TRIGGERS.has(tok)) {
      // find exact case in original and strip
      strippedTokens.push(tok);
    }
  }

  // 4. Extract date
  const dateMatch = extractDate(text, now);
  let date: Date;
  let explicit = false;
  if (dateMatch) {
    date = dateMatch.date;
    explicit = dateMatch.explicit;
    strippedTokens.push(dateMatch.matchStr);
  } else {
    date = new Date(now);
  }

  const dateStr = toDateString(date);
  const dateLabel = formatDateLabel(date, locale);

  // 5. Match category from remaining text
  // Build remaining text for category matching
  const remainingForCat = stripTokens(text, strippedTokens);
  const catMatch = matchCategory(remainingForCat || text, kind, categories);

  let categoryGuess: string | null = null;
  let categoryId: string | null = null;

  if (catMatch) {
    if (catMatch.mismatch) {
      warnings.push("category_kind_mismatch");
      categoryGuess = catMatch.name;
      categoryId = null; // don't assign mismatched category
    } else {
      categoryGuess = catMatch.name;
      categoryId = catMatch.id;
    }
  } else {
    warnings.push("no_category");
  }

  // 6. Build description: strip amount + currency + date + triggers, keep remainder
  const description = stripTokens(text, strippedTokens) || text;

  // 7. Compute confidence
  let confidence = 0.5; // base for having an amount
  if (categoryGuess && !warnings.includes("category_kind_mismatch")) confidence += 0.3;
  if (explicit) confidence += 0.2;

  return {
    amount: amountStr,
    currencyCode,
    kind,
    date: dateStr,
    dateLabel,
    categoryGuess,
    categoryId,
    description,
    raw: rawInput,
    confidence: Math.min(confidence, 1.0),
    warnings,
  };
}
