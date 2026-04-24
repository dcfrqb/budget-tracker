// ─────────────────────────────────────────────────────────────
// Date formatting utilities — locale-aware via Intl
// ─────────────────────────────────────────────────────────────

import type { Locale } from "@/lib/i18n/types";

/**
 * Formats a date as a short day + month string.
 * Examples: "1 мая" (ru), "May 1" (en)
 */
export function formatShortDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
  }).format(date);
}
