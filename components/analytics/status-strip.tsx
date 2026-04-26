"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/segmented";
import { useT, useLocale } from "@/lib/i18n/context";
import { formatMonthLong } from "@/lib/format/date";

// ─────────────────────────────────────────────────────────────
// Period type — maps to URL param ?p=
// ─────────────────────────────────────────────────────────────

export type AnalyticsPeriod = "1m" | "3m" | "6m" | "12m" | "ytd";

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = "3m";

export function parseAnalyticsPeriod(raw: string | undefined): AnalyticsPeriod {
  if (raw === "1m" || raw === "3m" || raw === "6m" || raw === "12m" || raw === "ytd") {
    return raw;
  }
  return DEFAULT_ANALYTICS_PERIOD;
}

// ─────────────────────────────────────────────────────────────
// Compare type — client-only, does not affect server data fetch
// ─────────────────────────────────────────────────────────────

type Cmp = "prev" | "yoy" | "none";

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function AnalyticsStatusStrip() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const now = new Date();
  const MONTH_DAY = now.getDate();
  const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const period = parseAnalyticsPeriod(searchParams.get("p") ?? undefined);

  // cmp stays client-only — does not affect server data fetching
  // TODO: migrate analytics compare to URL searchParams once Compare component reads it

  const PERIODS = [
    { id: "1m"  as AnalyticsPeriod, label: t("common.period.1m") },
    { id: "3m"  as AnalyticsPeriod, label: t("common.period.3m") },
    { id: "6m"  as AnalyticsPeriod, label: t("common.period.6m") },
    { id: "12m" as AnalyticsPeriod, label: t("common.period.12m") },
    { id: "ytd" as AnalyticsPeriod, label: t("common.period.ytd") },
  ];

  const CMP: { id: Cmp; label: string }[] = [
    { id: "prev", label: t("analytics.status_strip.cmp.prev") },
    { id: "yoy",  label: t("analytics.status_strip.cmp.yoy") },
    { id: "none", label: t("analytics.status_strip.cmp.none") },
  ];

  const handlePeriodChange = useCallback(
    (next: AnalyticsPeriod) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === DEFAULT_ANALYTICS_PERIOD) {
        params.delete("p");
      } else {
        params.set("p", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  // cmp is display-only for now
  const cmpOptions = CMP;
  const defaultCmp: Cmp = "prev";

  const monthLabel = formatMonthLong(now, locale);

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">{t("analytics.status_strip.period_label")}</span>
      <Segmented options={PERIODS} value={period} onChange={handlePeriodChange} />
      <span className="lbl">{t("analytics.status_strip.compare_label")}</span>
      <Segmented options={cmpOptions} value={defaultCmp} onChange={() => void 0} />
      <div className="clock-right">
        <span>{monthLabel} · <b>{t("home.status_strip.day_prefix")}{MONTH_DAY}/{MONTH_DAYS}</b></span>
        <span>{t("analytics.status_strip.sync", { vars: { sec: "2" } })}</span>
      </div>
    </div>
  );
}
