import type { DateRange } from "@/lib/data/analytics";

export type AnalyticsPeriod = "1m" | "3m" | "6m" | "12m" | "ytd";
export type AnalyticsCompare = "prev" | "yoy" | "none";

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

export function resolveCompareRange(
  currentRange: DateRange,
  compareMode: AnalyticsCompare,
): DateRange | null {
  if (compareMode === "none") return null;

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

const MONTH_SHORT_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const MONTH_SHORT_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatPeriodLabel(range: DateRange, locale: string): string {
  const months = locale === "ru" ? MONTH_SHORT_RU : MONTH_SHORT_EN;
  const from = range.from;
  const to = range.to;

  const fromMon = months[from.getUTCMonth()];
  const toMon = months[to.getUTCMonth()];

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
