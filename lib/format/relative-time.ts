import type { Locale } from "@/lib/i18n/types";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Internal locale-keyed message templates.
// Used without "ago" suffix so they compose into strings like "обн 4 мин".
const MESSAGES = {
  ru: {
    justNow: "только что",
    minutes: (n: number) => `${n} мин`,
    hours: (n: number) => `${n} ч`,
    yesterday: "вчера",
    days: (n: number) => `${n} д`,
  },
  en: {
    justNow: "just now",
    minutes: (n: number) => `${n}m`,
    hours: (n: number) => `${n}h`,
    yesterday: "yesterday",
    days: (n: number) => `${n}d`,
  },
} satisfies Record<Locale, {
  justNow: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  yesterday: string;
  days: (n: number) => string;
}>;

/**
 * Formats a past date as a short relative-time string, locale-aware.
 * No external i18n dependency — messages are internal constants.
 *
 * Examples (ru): "только что", "4 мин", "2 ч", "вчера", "3 д"
 * Examples (en): "just now", "4m", "2h", "yesterday", "3d"
 */
export function formatRelative(date: Date, locale: Locale, now: Date = new Date()): string {
  const msgs = MESSAGES[locale];
  const diff = now.getTime() - date.getTime();
  if (diff < MIN) return msgs.justNow;
  if (diff < HOUR) return msgs.minutes(Math.floor(diff / MIN));
  if (diff < DAY) return msgs.hours(Math.floor(diff / HOUR));
  if (diff < 2 * DAY) return msgs.yesterday;
  return msgs.days(Math.floor(diff / DAY));
}
