// ─────────────────────────────────────────────────────────────
// Date formatting utilities — locale-aware via Intl
// ─────────────────────────────────────────────────────────────

import type { Locale } from "@/lib/i18n/types";
import { DEFAULT_TZ } from "@/lib/constants";

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

// ─────────────────────────────────────────────────────────────
// Timezone-aware day-key helpers
// ─────────────────────────────────────────────────────────────

/**
 * Returns "YYYY-MM-DD" for a Date in the given IANA timezone.
 * en-CA locale produces ISO-style output (YYYY-MM-DD) from Intl.
 */
export function dayKeyInTz(d: Date, tz?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz ?? DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Returns "YYYY-MM-DD" for today in the given IANA timezone.
 */
export function todayKeyInTz(tz?: string): string {
  return dayKeyInTz(new Date(), tz);
}

/**
 * Returns "YYYY-MM-01" (first-of-month) for a Date in the given IANA timezone.
 */
export function monthKeyInTz(d: Date, tz?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz ?? DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "2000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}-01`;
}

/**
 * Returns the Monday-anchored week start as "YYYY-MM-DD" in the given timezone.
 * Does not return a Date object to avoid UTC drift.
 */
export function startOfWeekInTzKey(d: Date, tz?: string): string {
  const resolvedTz = tz ?? DEFAULT_TZ;
  const weekdayIdx = weekdayIndexInTz(d, resolvedTz); // 0=Sun … 6=Sat
  const mondayOffset = weekdayIdx === 0 ? 6 : weekdayIdx - 1; // days back to Monday
  // Use calendar-day arithmetic anchored at UTC noon to avoid DST skew.
  // No DST transition spans 12h, so noon + offset days always lands on the
  // intended Monday regardless of wall-clock jumps.
  const todayKey = dayKeyInTz(d, resolvedTz); // "YYYY-MM-DD"
  const [y, m, day] = todayKey.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  const monday = new Date(noon.getTime() - mondayOffset * 86400000);
  return dayKeyInTz(monday, resolvedTz);
}

/**
 * Returns 0-based weekday index (0=Sun … 6=Sat) in the given timezone.
 */
export function weekdayIndexInTz(d: Date, tz?: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz ?? DEFAULT_TZ,
    weekday: "short",
  }).formatToParts(d);
  const short = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[short] ?? 0;
}

/**
 * Returns true if two Dates fall on the same calendar day in the given timezone.
 */
export function sameDayInTz(a: Date, b: Date, tz?: string): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz ?? DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(a) === fmt.format(b);
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
