import Papa from "papaparse";
import type { GenericMapping, ImportRow } from "../types";
import { isTransferCategory } from "../categorize";

export type GenericParseOptions = {
  mapping: GenericMapping;
};

/**
 * Parses any CSV using a user-supplied column mapping.
 */
export function parseGeneric(
  csvText: string,
  options: GenericParseOptions,
): { rows: ImportRow[]; warnings: string[] } {
  const { mapping } = options;
  const delimiter = mapping.delimiter ?? ",";
  const warnings: string[] = [];

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  if (result.errors.length > 0) {
    for (const e of result.errors) {
      warnings.push(`parse_error:row${e.row}:${e.message}`);
    }
  }

  const rows: ImportRow[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const raw = result.data[i];
    const rowNum = i + 2;

    const dateRaw = raw[mapping.date] ?? "";
    const occurredAt = parseGenericDate(dateRaw);
    if (!occurredAt) {
      warnings.push(`bad_row:row${rowNum}:invalid_date:${dateRaw}`);
      continue;
    }

    const amountRaw = raw[mapping.amount] ?? "";
    const amountCleaned = amountRaw.replace(/[^\d.,\-]/g, "").replace(",", ".");
    const amountNum = parseFloat(amountCleaned);
    if (isNaN(amountNum)) {
      warnings.push(`bad_row:row${rowNum}:invalid_amount:${amountRaw}`);
      continue;
    }

    const absAmount = Math.abs(amountNum);
    const amountStr = absAmount.toFixed(2);

    const currencyCode = mapping.currency
      ? (raw[mapping.currency] ?? "RUB").toUpperCase()
      : "RUB";

    const rawCategory = mapping.category ? (raw[mapping.category] ?? undefined) : undefined;

    const kind: "INCOME" | "EXPENSE" | "TRANSFER" = isTransferCategory(rawCategory)
      ? "TRANSFER"
      : amountNum >= 0
        ? "INCOME"
        : "EXPENSE";

    const direction: "in" | "out" = amountNum >= 0 ? "in" : "out";

    const description = mapping.description ? (raw[mapping.description] ?? undefined) : undefined;

    rows.push({
      occurredAt,
      amount: amountStr,
      currencyCode,
      kind,
      direction,
      // Generic parser has no card column by default
      rawCategory: rawCategory || undefined,
      description: description || undefined,
      raw,
    });
  }

  return { rows, warnings };
}

/**
 * Returns column headers from the first line of a CSV.
 */
export function getCsvHeaders(
  csvText: string,
  delimiter = ",",
): string[] {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    delimiter,
    preview: 1,
  });
  if (result.data.length === 0) return [];
  return (result.data[0] as string[]).map((h) => h.trim());
}

/**
 * Returns a preview of the first N data rows (after header).
 */
export function getCsvPreviewRows(
  csvText: string,
  delimiter = ",",
  count = 3,
): string[][] {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    delimiter,
    preview: count + 1,
    skipEmptyLines: true,
  });
  // Skip header row
  return (result.data.slice(1) as string[][]);
}

/**
 * Attempts to guess column mapping from headers using keywords.
 */
export function guessGenericMapping(headers: string[]): Partial<GenericMapping> {
  const lower = headers.map((h) => h.toLowerCase());
  const guess: Partial<GenericMapping> = {};

  const findCol = (keywords: string[]): string | undefined => {
    for (const kw of keywords) {
      const idx = lower.findIndex((h) => h.includes(kw));
      if (idx !== -1) return headers[idx];
    }
    return undefined;
  };

  guess.date = findCol(["дата", "date", "время", "time"]);
  guess.amount = findCol(["сумма", "amount", "sum"]);
  guess.currency = findCol(["валюта", "currency", "ccy"]);
  guess.category = findCol(["категория", "category", "кат"]);
  guess.description = findCol(["описание", "description", "назначение", "comment", "memo", "примечание"]);

  return guess;
}

/**
 * Tries to parse a date string in various common formats.
 * Returns ISO string or null.
 */
function parseGenericDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try ISO: 2024-01-15 or 2024-01-15T10:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Try dd.MM.yyyy or dd/MM/yyyy with optional time component
  const dmyMatch = dateStr.match(
    /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (dmyMatch) {
    const [, dd, mm, yyyy, hh, mi, ss] = dmyMatch;
    const time =
      hh !== undefined
        ? `${hh}:${mi}:${ss !== undefined ? ss : "00"}`
        : "12:00:00";
    const d = new Date(
      `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${time}`,
    );
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Try MM/dd/yyyy (US format) with optional time component
  const mdyMatch = dateStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (mdyMatch) {
    const [, mm, dd, yyyy, hh, mi, ss] = mdyMatch;
    const time =
      hh !== undefined
        ? `${hh}:${mi}:${ss !== undefined ? ss : "00"}`
        : "12:00:00";
    const d = new Date(
      `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${time}`,
    );
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Last resort: let JS parse it
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString();

  return null;
}
