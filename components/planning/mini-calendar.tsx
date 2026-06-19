"use client";

import { useRouter } from "next/navigation";
import type { TimelineItemKind } from "@/lib/data/planning-timeline";

export type MiniCalendarLabels = {
  title: string;
  subtitle: string;
  click_hint: string;
  weekdays: string[];
  months: string[];
};

export type ItemCountsByDay = Record<
  string,
  Partial<Record<TimelineItemKind, number>>
>;

type Props = {
  itemsByDay: ItemCountsByDay;
  selectedDay: string | null;
  horizon: string;
  labels: MiniCalendarLabels;
};

const KIND_ORDER: TimelineItemKind[] = [
  "trip",
  "event",
  "subscription",
  "loan",
  "fund_target",
  "txn_planned",
];

function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function isoDay(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function MiniCalendar({ itemsByDay, selectedDay, horizon, labels }: Props) {
  const router = useRouter();
  const now = new Date();
  const todayIso = isoDay(now.getFullYear(), now.getMonth(), now.getDate());

  const months: { year: number; month: number }[] = [
    { year: now.getFullYear(), month: now.getMonth() },
    {
      year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(),
      month: (now.getMonth() + 1) % 12,
    },
  ];

  function handleDayClick(iso: string) {
    router.push(`/planning/events/new?date=${iso}`);
  }

  return (
    <div className="mini-cal">
      {months.map(({ year, month }) => {
        const rows = buildMonthGrid(year, month);
        const monthName = labels.months[month] ?? String(month + 1);
        return (
          <div key={`${year}-${month}`} className="mini-cal-month">
            <div className="mini-cal-month-hd">
              {monthName} {year}
            </div>
            <div className="mini-cal-grid">
              {labels.weekdays.map((wd) => (
                <div key={wd} className="mini-cal-wd">{wd}</div>
              ))}
              {rows.flat().map((day, i) => {
                if (day === null) {
                  return <div key={`e-${i}`} className="mini-cal-cell is-empty" />;
                }
                const iso = isoDay(year, month, day);
                const counts = itemsByDay[iso];
                const dotsData: { kind: TimelineItemKind; n: number }[] = [];
                if (counts) {
                  for (const kind of KIND_ORDER) {
                    const n = counts[kind] ?? 0;
                    if (n > 0) dotsData.push({ kind, n });
                  }
                }
                const totalDots = dotsData.reduce((s, d) => s + d.n, 0);
                const visibleDots = dotsData.slice(0, 3);
                const extra = totalDots - visibleDots.reduce((s, d) => s + d.n, 0);

                const isToday = iso === todayIso;
                const isSelected = iso === selectedDay;

                return (
                  <div
                    key={iso}
                    className={`mini-cal-cell${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
                    onClick={() => handleDayClick(iso)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDayClick(iso); } }}
                    role="button"
                    tabIndex={0}
                    aria-label={iso}
                    aria-pressed={isSelected}
                  >
                    <span className="mini-cal-day">{day}</span>
                    {dotsData.length > 0 && (
                      <div className="mini-cal-dots">
                        {visibleDots.map(({ kind }) => (
                          <span key={kind} className={`mini-cal-dot mini-cal-dot--${kind}`} />
                        ))}
                        {extra > 0 && (
                          <span className="mini-cal-more">+{extra}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
