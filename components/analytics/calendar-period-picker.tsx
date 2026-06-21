"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import type { TKey } from "@/lib/i18n/t";
import { parseCalendarPeriod, periodShortLabel } from "@/lib/analytics/period";

type PickerMode = "month" | "quarter" | "year";

const MONTH_SHORT_KEYS = [
  "jan","feb","mar","apr","may","jun",
  "jul","aug","sep","oct","nov","dec",
] as const;

const YEAR_COUNT = 5;

type Props = {
  currentP: string | null;
  onSelect: (p: string) => void;
};

export function CalendarPeriodPicker({ currentP, onSelect }: Props) {
  const t = useT();
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1; // 1-based
  const nowQuarter = Math.ceil(nowMonth / 3);

  const cal = currentP ? parseCalendarPeriod(currentP) : null;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>(
    cal ? cal.kind : "month",
  );
  const [pickerYear, setPickerYear] = useState<number>(
    cal ? cal.year : nowYear,
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state when the active calendar period changes from outside
  useEffect(() => {
    if (cal) {
      setMode(cal.kind);
      setPickerYear(cal.year);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentP]);

  // Click-outside close
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const isActive = cal !== null;
  const label = isActive && currentP
    ? periodShortLabel(currentP, t)
    : t("analytics.period.calendar.pick");

  function handleSelectMonth(monthIdx: number) {
    const mm = String(monthIdx + 1).padStart(2, "0");
    onSelect(`m${pickerYear}-${mm}`);
    setOpen(false);
  }

  function handleSelectQuarter(q: number) {
    onSelect(`q${pickerYear}-${q}`);
    setOpen(false);
  }

  function handleSelectYear(year: number) {
    onSelect(`y${year}`);
    setOpen(false);
  }

  const activeMonth = cal?.kind === "month" ? cal.month : null;
  const activeQuarter = cal?.kind === "quarter" ? cal.quarter : null;
  const activeYear = cal?.kind === "year" ? cal.year : null;

  const MODE_TABS: { id: PickerMode; labelKey: TKey }[] = [
    { id: "month",   labelKey: "analytics.period.calendar.month" },
    { id: "quarter", labelKey: "analytics.period.calendar.quarter" },
    { id: "year",    labelKey: "analytics.period.calendar.year" },
  ];

  return (
    <div className="cal-picker" ref={containerRef}>
      <button
        className={`cal-trigger${isActive ? " active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={t("analytics.period.calendar.title")}
        aria-expanded={open}
      >
        <span className="cal-icon" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="2" width="10" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M1 5h10" stroke="currentColor" strokeWidth="1"/>
            <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="cal-label">{label}</span>
      </button>

      {open && (
        <div className="cal-popover">
          {/* Mode tabs */}
          <div className="cal-mode-row">
            {MODE_TABS.map(({ id, labelKey }) => (
              <button
                key={id}
                className={`cal-mode-btn${mode === id ? " on" : ""}`}
                onClick={() => setMode(id)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          {/* Year stepper (month + quarter modes) */}
          {mode !== "year" && (
            <div className="cal-year-row">
              <button
                className="cal-step"
                onClick={() => setPickerYear((y) => y - 1)}
                aria-label={t("analytics.period.calendar.prev_year")}
              >
                &#8249;
              </button>
              <span className="cal-year-val">{pickerYear}</span>
              <button
                className="cal-step"
                onClick={() => setPickerYear((y) => y + 1)}
                disabled={pickerYear >= nowYear}
                aria-label={t("analytics.period.calendar.next_year")}
              >
                &#8250;
              </button>
            </div>
          )}

          {/* Month grid */}
          {mode === "month" && (
            <div className="cal-month-grid">
              {MONTH_SHORT_KEYS.map((key, i) => {
                const monthNum = i + 1;
                const isCurrentMonth =
                  activeMonth === monthNum &&
                  cal?.year === pickerYear;
                const isFuture = pickerYear === nowYear && monthNum > nowMonth;
                return (
                  <button
                    key={key}
                    className={`cal-cell${isCurrentMonth ? " on" : ""}${isFuture ? " disabled" : ""}`}
                    onClick={() => { if (!isFuture) handleSelectMonth(i); }}
                    disabled={isFuture}
                    aria-disabled={isFuture}
                  >
                    {t(`common.month.short.${key}` as TKey)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quarter grid */}
          {mode === "quarter" && (
            <div className="cal-quarter-grid">
              {([1, 2, 3, 4] as const).map((q) => {
                const isActive =
                  activeQuarter === q &&
                  cal?.year === pickerYear;
                const isFuture = pickerYear === nowYear && q > nowQuarter;
                return (
                  <button
                    key={q}
                    className={`cal-cell${isActive ? " on" : ""}${isFuture ? " disabled" : ""}`}
                    onClick={() => { if (!isFuture) handleSelectQuarter(q); }}
                    disabled={isFuture}
                    aria-disabled={isFuture}
                  >
                    Q{q}
                  </button>
                );
              })}
            </div>
          )}

          {/* Year list */}
          {mode === "year" && (
            <div className="cal-year-list">
              {Array.from({ length: YEAR_COUNT }, (_, i) => nowYear - i).map((yr) => (
                <button
                  key={yr}
                  className={`cal-year-item${activeYear === yr ? " on" : ""}`}
                  onClick={() => handleSelectYear(yr)}
                >
                  {yr}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
