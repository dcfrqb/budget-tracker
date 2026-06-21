import type { DateRange } from "@/lib/data/analytics";
import type { TKey } from "@/lib/i18n/t";
import { startOfMonthUtcInTz, addMonths } from "@/lib/data/_period";

export type AnalyticsPeriod = "1m" | "3m" | "6m" | "12m" | "ytd";
export type AnalyticsCompare = "prev" | "yoy" | "none";

// ─── Calendar period parsing ──────────────────────────────────────────────────

export type CalendarPeriodMonth = { kind: "month"; year: number; month: number };
export type CalendarPeriodQuarter = { kind: "quarter"; year: number; quarter: number };
export type CalendarPeriodYear = { kind: "year"; year: number };
export type CalendarPeriod = CalendarPeriodMonth | CalendarPeriodQuarter | CalendarPeriodYear;

/**
 * Parse calendar period codes:
 *   m2026-04  → { kind: "month", year: 2026, month: 4 }
 *   q2026-1   → { kind: "quarter", year: 2026, quarter: 1 }
 *   y2025     → { kind: "year", year: 2025 }
 * Returns null for anything else (rolling codes, invalid ranges).
 */
export function parseCalendarPeriod(raw: string): CalendarPeriod | null {
  if (raw.startsWith("m")) {
    const m = raw.slice(1).match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return { kind: "month", year, month };
  }
  if (raw.startsWith("q")) {
    const m = raw.slice(1).match(/^(\d{4})-([1-4])$/);
    if (!m) return null;
    const year = Number(m[1]);
    const quarter = Number(m[2]);
    return { kind: "quarter", year, quarter };
  }
  if (raw.startsWith("y")) {
    const m = raw.slice(1).match(/^(\d{4})$/);
    if (!m) return null;
    return { kind: "year", year: Number(m[1]) };
  }
  return null;
}

export type DynamicCalendarCode = "tm" | "tq" | "ty";

export function isDynamicCalendarCode(raw: string): raw is DynamicCalendarCode {
  return raw === "tm" || raw === "tq" || raw === "ty";
}

export function isCalendarPeriod(raw: string): boolean {
  return parseCalendarPeriod(raw) !== null || isDynamicCalendarCode(raw);
}

/**
 * Resolve "tm" / "tq" / "ty" to a CalendarPeriod representing the current
 * month / quarter / year in the given timezone.
 */
export function resolveDynamicCalendar(
  code: DynamicCalendarCode,
  tz: string,
  now: Date = new Date(),
): CalendarPeriod {
  // Determine current year and month in tz by reading back from the UTC anchor
  const ymFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  });
  const parts = ymFmt.formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);

  if (code === "tm") {
    return { kind: "month", year, month };
  }
  if (code === "tq") {
    const quarter = Math.ceil(month / 3);
    return { kind: "quarter", year, quarter };
  }
  // ty
  return { kind: "year", year };
}

/**
 * Resolve any calendar code (frozen or dynamic) to a DateRange, or null if
 * the raw string is not a calendar code (caller should try rolling resolver).
 */
export function resolveAnyCalendarRange(
  raw: string,
  tz: string,
  now: Date = new Date(),
): DateRange | null {
  if (isDynamicCalendarCode(raw)) {
    return resolveCalendarRange(resolveDynamicCalendar(raw, tz, now), tz);
  }
  const cal = parseCalendarPeriod(raw);
  if (cal) return resolveCalendarRange(cal, tz);
  return null;
}

/**
 * Compute DateRange for a calendar period using tz-aware month boundaries.
 * Range is [start of first month, start of month after last month) — exclusive upper.
 */
export function resolveCalendarRange(cal: CalendarPeriod, tz: string): DateRange {
  if (cal.kind === "month") {
    const anchor = new Date(Date.UTC(cal.year, cal.month - 1, 15));
    const from = startOfMonthUtcInTz(tz, anchor);
    const to = addMonths(from, 1);
    return { from, to };
  }
  if (cal.kind === "quarter") {
    const firstMonth = (cal.quarter - 1) * 3 + 1;
    const anchor = new Date(Date.UTC(cal.year, firstMonth - 1, 15));
    const from = startOfMonthUtcInTz(tz, anchor);
    const to = addMonths(from, 3);
    return { from, to };
  }
  // year
  const anchor = new Date(Date.UTC(cal.year, 0, 15));
  const from = startOfMonthUtcInTz(tz, anchor);
  const to = addMonths(from, 12);
  return { from, to };
}

// ─── periodShortLabel — extended for calendar codes ───────────────────────────

const MONTH_SHORT_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

export function periodShortLabel(periodCode: string, t: (key: TKey) => string): string {
  if (periodCode === "tm") return t("common.period.this_month");
  if (periodCode === "tq") return t("common.period.this_quarter");
  if (periodCode === "ty") return t("common.period.this_year");
  const cal = parseCalendarPeriod(periodCode);
  if (cal) {
    if (cal.kind === "month") {
      const monKey = MONTH_SHORT_KEYS[cal.month - 1];
      return `${t(`common.month.short.${monKey}` as TKey)} ${cal.year}`;
    }
    if (cal.kind === "quarter") {
      return `Q${cal.quarter} ${cal.year}`;
    }
    return String(cal.year);
  }
  // Rolling
  if (periodCode === "1m") return t("common.period.1m");
  if (periodCode === "3m") return t("common.period.3m");
  if (periodCode === "6m") return t("common.period.6m");
  if (periodCode === "12m") return t("common.period.12m");
  return t("common.period.ytd");
}

const AVG_DAYS_PER_MONTH = 30.4375;

export function periodMonthCount(period: AnalyticsPeriod, range: DateRange): number {
  const days = (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(1 / 30, days / AVG_DAYS_PER_MONTH);
}

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = "3m";
export const DEFAULT_ANALYTICS_COMPARE: AnalyticsCompare = "prev";

export function parseAnalyticsPeriod(raw: string | undefined): AnalyticsPeriod {
  if (raw === "1m" || raw === "3m" || raw === "6m" || raw === "12m" || raw === "ytd") {
    return raw;
  }
  return DEFAULT_ANALYTICS_PERIOD;
}

export function parseAnalyticsCompare(raw: string | undefined): AnalyticsCompare {
  if (raw === "prev" || raw === "yoy" || raw === "none") {
    return raw;
  }
  return DEFAULT_ANALYTICS_COMPARE;
}

/**
 * Resolve the comparison range.
 * When `rawPeriod` is a calendar code and `tz` is provided, the comparison
 * uses exact calendar boundaries (prev month/quarter/year, or yoy equivalent).
 * For rolling periods the legacy offset-based behaviour is preserved exactly.
 */
export function resolveCompareRange(
  currentRange: DateRange,
  compareMode: AnalyticsCompare,
  rawPeriod?: string,
  tz?: string,
): DateRange | null {
  if (compareMode === "none") return null;

  // Calendar-aware branch
  if (rawPeriod && tz) {
    const cal = parseCalendarPeriod(rawPeriod);
    if (cal) {
      if (compareMode === "prev") {
        if (cal.kind === "month") {
          const prevMonth = cal.month === 1 ? 12 : cal.month - 1;
          const prevYear = cal.month === 1 ? cal.year - 1 : cal.year;
          return resolveCalendarRange({ kind: "month", year: prevYear, month: prevMonth }, tz);
        }
        if (cal.kind === "quarter") {
          const prevQ = cal.quarter === 1 ? 4 : cal.quarter - 1;
          const prevYear = cal.quarter === 1 ? cal.year - 1 : cal.year;
          return resolveCalendarRange({ kind: "quarter", year: prevYear, quarter: prevQ }, tz);
        }
        // year
        return resolveCalendarRange({ kind: "year", year: cal.year - 1 }, tz);
      }
      if (compareMode === "yoy") {
        if (cal.kind === "month") {
          return resolveCalendarRange({ kind: "month", year: cal.year - 1, month: cal.month }, tz);
        }
        if (cal.kind === "quarter") {
          return resolveCalendarRange({ kind: "quarter", year: cal.year - 1, quarter: cal.quarter }, tz);
        }
        // year → previous year (yoy of a year = the year before)
        return resolveCalendarRange({ kind: "year", year: cal.year - 1 }, tz);
      }
    }
  }

  // Rolling / legacy branch — unchanged
  const len = currentRange.to.getTime() - currentRange.from.getTime();

  if (compareMode === "prev") {
    return {
      from: new Date(currentRange.from.getTime() - len),
      to: new Date(currentRange.to.getTime() - len),
    };
  }

  if (compareMode === "yoy") {
    return {
      from: new Date(
        Date.UTC(
          currentRange.from.getUTCFullYear() - 1,
          currentRange.from.getUTCMonth(),
          currentRange.from.getUTCDate(),
        ),
      ),
      to: new Date(
        Date.UTC(
          currentRange.to.getUTCFullYear() - 1,
          currentRange.to.getUTCMonth(),
          currentRange.to.getUTCDate(),
          currentRange.to.getUTCHours(),
          currentRange.to.getUTCMinutes(),
          currentRange.to.getUTCSeconds(),
          currentRange.to.getUTCMilliseconds(),
        ),
      ),
    };
  }

  return null;
}

const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

export function formatPeriodLabel(range: DateRange, t: (key: TKey) => string): string {
  const from = range.from;
  const to = range.to;

  const fromMon = t(`common.month.short.${MONTH_KEYS[from.getUTCMonth()]}` as TKey);
  const toMon = t(`common.month.short.${MONTH_KEYS[to.getUTCMonth()]}` as TKey);

  const fromYear = from.getUTCFullYear();
  const toYear = to.getUTCFullYear();

  if (fromYear === toYear) {
    if (from.getUTCMonth() === to.getUTCMonth()) {
      return `${fromMon} ${fromYear}`;
    }
    return `${fromMon} — ${toMon} ${toYear}`;
  }
  return `${fromMon} ${fromYear} — ${toMon} ${toYear}`;
}
