import Papa from "papaparse";
import type { ImportRow } from "../types";

export type TinkoffParseOptions = {
  delimiter?: ";" | ",";
  encoding?: "utf-8" | "windows-1251";
};

// Column names as they appear in Tinkoff CSV export
const COL_DATE = "Дата операции";
const COL_STATUS = "Статус";
const COL_AMOUNT = "Сумма операции";
const COL_CURRENCY = "Валюта операции";
const COL_CATEGORY = "Категория";
const COL_DESCRIPTION = "Описание";

/**
 * Parses a Tinkoff bank CSV statement string into ImportRow[].
 * Only rows with status "OK" are included; "FAILED"/"CANCELLED" are skipped with warnings.
 */
export function parseTinkoff(
  csvText: string,
  options: TinkoffParseOptions = {},
): { rows: ImportRow[]; warnings: string[] } {
  const { delimiter = ";" } = options;
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
    const rowNum = i + 2; // 1-indexed, header is row 1

    const status = raw[COL_STATUS] ?? "";
    if (status === "FAILED" || status === "CANCELLED") {
      warnings.push(`skipped:row${rowNum}:status_${status.toLowerCase()}`);
      continue;
    }

    const dateStr = raw[COL_DATE] ?? "";
    const occurredAt = parseTinkoffDate(dateStr);
    if (!occurredAt) {
      warnings.push(`bad_row:row${rowNum}:invalid_date:${dateStr}`);
      continue;
    }

    const amountRaw = raw[COL_AMOUNT] ?? "";
    const amountNum = parseFloat(amountRaw.replace(",", ".").replace(/\s/g, ""));
    if (isNaN(amountNum)) {
      warnings.push(`bad_row:row${rowNum}:invalid_amount:${amountRaw}`);
      continue;
    }

    const absAmount = Math.abs(amountNum);
    const kind: "INCOME" | "EXPENSE" = amountNum >= 0 ? "INCOME" : "EXPENSE";
    const amountStr = absAmount.toFixed(2);

    const currencyCode = normalizeCurrency(raw[COL_CURRENCY] ?? "RUB");
    const rawCategory = raw[COL_CATEGORY] ?? undefined;
    const description = raw[COL_DESCRIPTION] ?? undefined;

    const descForId = (description ?? "").substring(0, 32);
    const externalId = `tinkoff:${occurredAt}:${amountStr}:${descForId}`;

    rows.push({
      externalId,
      occurredAt,
      amount: amountStr,
      currencyCode,
      kind,
      rawCategory: rawCategory || undefined,
      description: description || undefined,
      raw,
    });
  }

  return { rows, warnings };
}

/**
 * Parses Tinkoff date format: "dd.MM.yyyy HH:mm:ss" or "dd.MM.yyyy"
 */
function parseTinkoffDate(dateStr: string): string | null {
  // Try "dd.MM.yyyy HH:mm:ss"
  const fullMatch = dateStr.match(
    /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/,
  );
  if (fullMatch) {
    const [, dd, mm, yyyy, hh, min, ss] = fullMatch;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.000Z`;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    // Store as local midnight to avoid timezone shifts changing the date
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`).toISOString();
  }

  // Try "dd.MM.yyyy"
  const shortMatch = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (shortMatch) {
    const [, dd, mm, yyyy] = shortMatch;
    return new Date(`${yyyy}-${mm}-${dd}T12:00:00`).toISOString();
  }

  return null;
}

function normalizeCurrency(code: string): string {
  const map: Record<string, string> = {
    "RUB": "RUB",
    "RUR": "RUB",
    "USD": "USD",
    "EUR": "EUR",
  };
  const upper = code.toUpperCase();
  return map[upper] ?? upper;
}
