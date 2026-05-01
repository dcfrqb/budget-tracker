import { formatRelative } from "@/lib/format/relative-time";
import type { Locale } from "@/lib/i18n/types";

export const STALE_THRESHOLD_MS = 30 * 60 * 60 * 1000; // 30h

/** True if rates are missing or older than 30h. */
export function isStale(latestRecordedAt: Date | null): boolean {
  if (!latestRecordedAt) return true;
  return Date.now() - latestRecordedAt.getTime() > STALE_THRESHOLD_MS;
}

/**
 * Returns a short relative-time string for displaying when rates were last updated.
 * Delegates to the existing formatRelative helper in lib/format/.
 *
 * Examples (ru): "только что", "4 мин", "2 ч", "вчера", "3 д"
 * Examples (en): "just now", "4m", "2h", "yesterday", "3d"
 */
export function formatAgo(
  date: Date,
  locale: Locale,
  now?: Date,
): string {
  return formatRelative(date, locale, now);
}
