"use client";

import Link from "next/link";
import type { TimelineItemKind } from "@/lib/data/planning-timeline";

export type TimelineItemView = {
  id: string;
  kind: TimelineItemKind;
  date: Date;
  isoDate: string;
  label: string;
  formattedAmount: string | null;
  href: string;
  glyph: string;
};

export type TimelineLabels = {
  title: string;
  subtitle: string;
  empty_title: string;
  empty_body: string;
  today: string;
};

type Props = {
  items: TimelineItemView[];
  horizonDays: number;
  selectedDay: string | null;
  labels: TimelineLabels;
};

function computeTicks(from: Date, to: Date, horizonDays: number): { pct: number; label: string }[] {
  const totalMs = to.getTime() - from.getTime();
  const ticks: { pct: number; label: string }[] = [];

  if (horizonDays <= 30) {
    // daily ticks
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    cur.setDate(cur.getDate() + 1);
    while (cur <= to) {
      const pct = (cur.getTime() - from.getTime()) / totalMs * 100;
      const day = cur.getDate();
      ticks.push({ pct, label: String(day) });
      cur.setDate(cur.getDate() + 1);
    }
  } else if (horizonDays <= 90) {
    // weekly ticks (every Monday)
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    const dayOfWeek = cur.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    cur.setDate(cur.getDate() + daysToMonday);
    while (cur <= to) {
      const pct = (cur.getTime() - from.getTime()) / totalMs * 100;
      ticks.push({ pct, label: `${cur.getDate()}/${cur.getMonth() + 1}` });
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    // monthly ticks (1st of each month)
    const cur = new Date(from);
    cur.setDate(1);
    cur.setHours(0, 0, 0, 0);
    cur.setMonth(cur.getMonth() + 1);
    while (cur <= to) {
      const pct = (cur.getTime() - from.getTime()) / totalMs * 100;
      ticks.push({ pct, label: `${cur.getMonth() + 1}/${cur.getFullYear().toString().slice(2)}` });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  return ticks;
}

export function Timeline({ items, horizonDays, selectedDay, labels }: Props) {
  const now = new Date();
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const totalMs = to.getTime() - from.getTime();

  const todayPct = Math.min(100, Math.max(0, (now.getTime() - from.getTime()) / totalMs * 100));
  const ticks = computeTicks(from, to, horizonDays);

  // Assign lanes per ISO date bucket
  const laneByDate = new Map<string, number>();
  const laneCountByDate = new Map<string, number>();
  for (const item of items) {
    const d = item.isoDate;
    const lane = laneCountByDate.get(d) ?? 0;
    laneByDate.set(item.id, lane);
    laneCountByDate.set(d, lane + 1);
  }

  const maxLanes = Math.max(0, ...Array.from(laneCountByDate.values()));
  const trackHeight = Math.max(80, (maxLanes + 1) * 28 + 50);

  return (
    <div className="tl-h">
      <div className="tl-h-hd">
        <span className="tl-h-title">{labels.title}</span>
        <span className="tl-h-sub">{labels.subtitle}</span>
      </div>

      {items.length === 0 ? (
        <div className="tl-empty">
          <div className="tl-empty-title">{labels.empty_title}</div>
          <div className="tl-empty-body">{labels.empty_body}</div>
        </div>
      ) : null}

      <div className="tl-track" style={{ height: `${trackHeight}px` }}>
        {/* Axis */}
        <div className="tl-axis">
          {ticks.map((tick, i) => (
            <div key={i} className="tl-tick" style={{ left: `${tick.pct}%` }}>
              <span className="tl-tick-label">{tick.label}</span>
            </div>
          ))}
          {/* Today marker */}
          <div className="tl-today" style={{ left: `${todayPct}%` }}>
            <span className="tl-today-chip">{labels.today}</span>
          </div>
        </div>

        {/* Chips */}
        <div className="tl-chips-layer">
          {items.map((item) => {
            const pct = Math.min(99, Math.max(0,
              (item.date.getTime() - from.getTime()) / totalMs * 100
            ));
            const lane = laneByDate.get(item.id) ?? 0;
            const topPx = lane * 28;

            const isFaded = selectedDay !== null && item.isoDate !== selectedDay;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`tl-chip tl-chip--${item.kind}${isFaded ? " is-faded" : ""}`}
                style={{ left: `${pct}%`, top: `${topPx}px` }}
                title={item.label}
              >
                <span className="tl-chip-glyph">{item.glyph}</span>
                <span className="tl-chip-label">{item.label}</span>
                {item.formattedAmount && (
                  <span className="tl-chip-amt">{item.formattedAmount}</span>
                )}
                <div className="tl-pop">
                  <div className="tl-pop-label">{item.label}</div>
                  <div className="tl-pop-date">{item.isoDate}</div>
                  {item.formattedAmount && (
                    <div className="tl-pop-amt">{item.formattedAmount}</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
