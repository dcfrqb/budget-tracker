"use client";

import { useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Segmented } from "@/components/segmented";
import { CalendarPeriodPicker } from "@/components/period/calendar-period-picker";
import { isCalendarPeriod } from "@/lib/analytics/period";

type TxnType = "all" | "inc" | "exp" | "xfr" | "loan";
type Period = "7d" | "30d" | "90d" | "1y";

const ROLLING_PERIODS = new Set<string>(["7d", "30d", "90d", "1y"]);

export function TxnStatusStrip() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const type = (sp.get("type") as TxnType) ?? "all";
  const rawPeriod = sp.get("period") ?? null;
  const calendarActive = rawPeriod ? isCalendarPeriod(rawPeriod) : false;
  const period = (rawPeriod && ROLLING_PERIODS.has(rawPeriod) ? rawPeriod : "30d") as Period;

  const TYPES: { id: TxnType; label: string }[] = [
    { id: "all",  label: t("transactions.filter.type_all") },
    { id: "inc",  label: t("transactions.filter.type_inc") },
    { id: "exp",  label: t("transactions.filter.type_exp") },
    { id: "xfr",  label: t("transactions.filter.type_xfr") },
    { id: "loan", label: t("transactions.filter.type_loan") },
  ];

  const PERIODS: { id: Period; label: string }[] = [
    { id: "7d",  label: t("transactions.filter.period_7d") },
    { id: "30d", label: t("transactions.filter.period_30d") },
    { id: "90d", label: t("transactions.filter.period_90d") },
    { id: "1y",  label: t("transactions.filter.period_1y") },
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
  const monthLabel = `${now.getFullYear()}`;
  const monthDay = now.getDate();
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">{t("transactions.filter.label_type")}</span>
      <Segmented
        options={TYPES}
        value={type}
        onChange={(v) => push("type", v)}
      />

      <span className="lbl">{t("transactions.filter.label_period")}</span>
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
        <span>
          {monthLabel} · <b>{t("common.unit.day")}{monthDay}/{monthDays}</b>
        </span>
      </div>
    </div>
  );
}
