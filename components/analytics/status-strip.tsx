"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/segmented";
import { useT, useLocale } from "@/lib/i18n/context";
import { formatMonthLong } from "@/lib/format/date";
import {
  type AnalyticsPeriod,
  type AnalyticsCompare,
  DEFAULT_ANALYTICS_PERIOD,
  DEFAULT_ANALYTICS_COMPARE,
  parseAnalyticsPeriod,
  parseAnalyticsCompare,
  isCalendarPeriod,
} from "@/lib/analytics/period";
import { CalendarPeriodPicker } from "@/components/period/calendar-period-picker";

export type { AnalyticsPeriod };
export { DEFAULT_ANALYTICS_PERIOD, parseAnalyticsPeriod };

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function AnalyticsStatusStrip() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const MONTH_DAY = now.getDate();
  const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const rawP = searchParams.get("p") ?? undefined;
  const calendarActive = rawP ? isCalendarPeriod(rawP) : false;

  const period = calendarActive
    ? DEFAULT_ANALYTICS_PERIOD
    : parseAnalyticsPeriod(rawP);
  const cmp = parseAnalyticsCompare(searchParams.get("cmp") ?? undefined);

  const [optimisticPeriod, setOptimisticPeriod] = useOptimistic<AnalyticsPeriod, AnalyticsPeriod>(
    period,
    (_, next) => next,
  );

  const [optimisticCmp, setOptimisticCmp] = useOptimistic<AnalyticsCompare, AnalyticsCompare>(
    cmp,
    (_, next) => next,
  );

  const PERIODS = [
    { id: "1m"  as AnalyticsPeriod, label: t("common.period.1m") },
    { id: "3m"  as AnalyticsPeriod, label: t("common.period.3m") },
    { id: "6m"  as AnalyticsPeriod, label: t("common.period.6m") },
    { id: "12m" as AnalyticsPeriod, label: t("common.period.12m") },
    { id: "ytd" as AnalyticsPeriod, label: t("common.period.ytd") },
  ];

  const CMP: { id: AnalyticsCompare; label: string }[] = [
    { id: "prev", label: t("analytics.compare.label_prev") },
    { id: "yoy",  label: t("analytics.compare.label_yoy") },
    { id: "none", label: t("analytics.compare.label_none") },
  ];

  function handlePeriodChange(next: AnalyticsPeriod) {
    startTransition(() => {
      setOptimisticPeriod(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === DEFAULT_ANALYTICS_PERIOD) {
        params.delete("p");
      } else {
        params.set("p", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function handleCalendarSelect(calCode: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("p", calCode);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function handleCmpChange(next: AnalyticsCompare) {
    startTransition(() => {
      setOptimisticCmp(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === DEFAULT_ANALYTICS_COMPARE) {
        params.delete("cmp");
      } else {
        params.set("cmp", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  const monthLabel = formatMonthLong(now, locale);

  // When calendar is active, render Segmented with a value not in the options list
  // so no option appears highlighted. Cast needed since the type is constrained.
  const displayedPeriod = calendarActive
    ? ("" as AnalyticsPeriod)
    : optimisticPeriod;

  return (
    <div
      className="status-strip fade-in"
      style={{
        animationDelay: "0ms",
        opacity: isPending ? 0.6 : 1,
        transition: "opacity var(--d-fast) var(--e-out)",
      }}
    >
      <span className="lbl">{t("analytics.status_strip.period_label")}</span>
      <Segmented options={PERIODS} value={displayedPeriod} onChange={handlePeriodChange} />
      <CalendarPeriodPicker
        currentP={calendarActive ? (rawP ?? null) : null}
        onSelect={handleCalendarSelect}
      />
      <span className="lbl">{t("analytics.status_strip.compare_label")}</span>
      <Segmented options={CMP} value={optimisticCmp} onChange={handleCmpChange} />
      <div className="clock-right">
        <span>{monthLabel} · <b title={t("analytics.status_strip.day_hint")}>{MONTH_DAY}/{MONTH_DAYS}</b></span>
      </div>
    </div>
  );
}
