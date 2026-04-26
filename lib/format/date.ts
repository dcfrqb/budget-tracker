// ─────────────────────────────────────────────────────────────
// Date formatting utilities — locale-aware via Intl
// ─────────────────────────────────────────────────────────────

import type { Locale } from "@/lib/i18n/types";

function toIntlLocale(locale: Locale): string {
  return locale === "ru" ? "ru-RU" : "en-US";
}

/**
 * Formats a date as a short day + month string.
 * Examples: "1 мая" (ru), "May 1" (en)
 */
export function formatShortDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: "numeric",
    month: "short",
  }).format(date);
}

/**
 * Formats a date as a numeric day/month/year string
 * (equivalent to Date.prototype.toLocaleDateString without a hardcoded locale).
 * Examples: "26.04.2026" (ru), "4/26/2026" (en)
 */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Formats a date as abbreviated month + 2-digit year.
 * Examples: "апр. 26" (ru), "Apr 26" (en)
 */
export function formatMonthYear(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: "short",
    year: "2-digit",
  }).format(date);
}

/**
 * Formats a date as full month name + full year.
 * Examples: "апрель 2026" (ru), "April 2026" (en)
 */
export function formatMonthLong(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: "long",
    year: "numeric",
  }).format(date);
}
