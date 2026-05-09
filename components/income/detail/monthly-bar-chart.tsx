"use client";

import { useT } from "@/lib/i18n/context";
import type { WorkSourceMonthlyBucket } from "@/lib/data/work-sources";

const SVG_H = 100;
const PAD_TOP = 8;
const PAD_BOTTOM = 24;
const BAR_PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;

interface Props {
  series: WorkSourceMonthlyBucket[];
  sourceCcy: string;
}

export function MonthlyBarChart({ series, sourceCcy }: Props) {
  const t = useT();

  function shortMonthLabel(key: string, narrow: boolean): string {
    const [yr, mo] = key.split("-");
    const month = parseInt(mo, 10);
    const abbrev = t(`common.month.short.${month}` as Parameters<typeof t>[0]);
    if (narrow) return abbrev.charAt(0);
    return `${abbrev} ${yr?.slice(2)}`;
  }

  const totals = series.map((b) => Number(b.total.toString()));
  const maxVal = Math.max(...totals, 1);

  const isEmpty = totals.every((v) => v === 0);

  void sourceCcy;

  if (isEmpty) {
    return (
      <div
        className="section"
        style={{ borderBottom: "1px solid var(--border)", padding: "var(--sp-3)" }}
      >
        <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
          {t("income.work.detail.chart.monthly")} · {t("income.work.detail.chart.empty")}
        </div>
      </div>
    );
  }

  const n = series.length;
  const barW = n > 0 ? Math.floor(100 / n) : 10;
  const gap = Math.max(1, Math.floor(barW * 0.15));
  const netBarW = barW - gap;

  return (
    <div
      className="section"
      style={{ borderBottom: "1px solid var(--border)", padding: "var(--sp-3)" }}
    >
      <div
        className="mono"
        style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: 8 }}
      >
        {t("income.work.detail.chart.monthly")}
      </div>
      <div className="ws-bar-chart-wrap" style={{ width: "100%", overflow: "hidden" }}>
        <svg
          viewBox={`0 0 100 ${SVG_H}`}
          preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: SVG_H }}
        >
          {/* baseline */}
          <line
            x1="0"
            y1={SVG_H - PAD_BOTTOM}
            x2="100"
            y2={SVG_H - PAD_BOTTOM}
            stroke="var(--border)"
            strokeWidth={0.5}
          />
          {series.map((bucket, i) => {
            const val = Number(bucket.total.toString());
            const barH = Math.max(1, (val / maxVal) * BAR_PLOT_H);
            const x = i * barW;
            const y = SVG_H - PAD_BOTTOM - barH;

            const isNarrow = n > 8;
            const label = shortMonthLabel(bucket.monthKey, isNarrow);

            return (
              <g key={bucket.monthKey}>
                <rect
                  x={x + gap / 2}
                  y={y}
                  width={netBarW}
                  height={barH}
                  fill="var(--accent)"
                  rx={0.5}
                  opacity={0.85}
                />
                <text
                  x={x + barW / 2}
                  y={SVG_H - 4}
                  textAnchor="middle"
                  fontSize={5}
                  fill="var(--muted)"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
