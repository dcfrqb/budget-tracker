"use client";

import { useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Segmented } from "@/components/segmented";
import { CalendarPeriodPicker } from "@/components/period/calendar-period-picker";
import { isCalendarPeriod } from "@/lib/analytics/period";

type View = "sources" | "expected" | "other";
type Period = "30d" | "90d" | "1y" | "all";

const ROLLING_PERIODS = new Set<string>(["30d", "90d", "1y", "all"]);

export function IncomeStatusStrip() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const view = (sp.get("tab") as View) ?? "sources";
  const rawPeriod = sp.get("period") ?? null;
  const calendarActive = rawPeriod ? isCalendarPeriod(rawPeriod) : false;
  const period = (rawPeriod && ROLLING_PERIODS.has(rawPeriod) ? rawPeriod : "90d") as Period;

  const VIEWS: { id: View; label: string }[] = [
    { id: "sources",  label: t("income.filter.view_sources") },
    { id: "expected", label: t("income.filter.view_expected") },
    { id: "other",    label: t("income.filter.view_other") },
  ];

  const PERIODS: { id: Period; label: string }[] = [
    { id: "30d", label: t("income.filter.period_30d") },
    { id: "90d", label: t("income.filter.period_90d") },
    { id: "1y",  label: t("income.filter.period_1y") },
    { id: "all", label: t("income.filter.period_all") },
  ];

  const push = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      params.set(key, value);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [sp, router],
  );

  function handleCalendarSelect(calCode: string) {
    startTransition(() => {
      const params = new URLSearchParams(sp.toString());
      params.set("period", calCode);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const displayedPeriod = calendarActive ? ("" as Period) : period;

  const now = new Date();
  const monthDay = now.getDate();
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">{t("income.filter.label_view")}</span>
      <Segmented
        options={VIEWS}
        value={view}
        onChange={(v) => push("tab", v)}
      />
      <span className="lbl">{t("income.filter.label_period")}</span>
      <Segmented
        options={PERIODS}
        value={displayedPeriod}
        onChange={(v) => push("period", v)}
      />
      <CalendarPeriodPicker
        currentP={calendarActive ? rawPeriod : null}
        onSelect={handleCalendarSelect}
      />
      <div className="clock-right">
        <span title={t("income.filter.day_of_month_hint")}>
          {now.getFullYear()} · <b>{monthDay}/{monthDays}</b>
        </span>
      </div>
    </div>
  );
}
