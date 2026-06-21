"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { CalendarPeriodPicker } from "@/components/period/calendar-period-picker";
import { isCalendarPeriod } from "@/lib/analytics/period";
import type { PeriodCode } from "@/lib/data/work-sources";

const PERIODS: PeriodCode[] = ["1m", "3m", "6m", "12m", "all"];

interface Props {
  active: PeriodCode;
  rawPeriod?: string | null;
}

export function DetailPeriodTabs({ active, rawPeriod }: Props) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const calendarActive = rawPeriod ? isCalendarPeriod(rawPeriod) : false;

  function handleClick(period: PeriodCode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleCalendarSelect(calCode: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", calCode);
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className="section"
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "var(--sp-2) var(--sp-3)",
        display: "flex",
        gap: "var(--sp-2)",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {PERIODS.map((p) => (
        <button
          key={p}
          className={`btn btn-xs mono${!calendarActive && active === p ? " primary" : ""}`}
          onClick={() => handleClick(p)}
        >
          {t(`income.work.detail.period.${p}` as Parameters<typeof t>[0])}
        </button>
      ))}
      <CalendarPeriodPicker
        currentP={calendarActive ? (rawPeriod ?? null) : null}
        onSelect={handleCalendarSelect}
      />
    </div>
  );
}
