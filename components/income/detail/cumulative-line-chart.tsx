"use client";

import { useT } from "@/lib/i18n/context";
import type { WorkSourceMonthlyBucket } from "@/lib/data/work-sources";

const SVG_W = 560;
const SVG_H = 80;
const PAD_TOP = 8;
const PAD_BOTTOM = 20;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;

interface Props {
  series: WorkSourceMonthlyBucket[];
  sourceCcy: string;
}

export function CumulativeLineChart({ series, sourceCcy }: Props) {
  const t = useT();
  void sourceCcy;

  // Build cumulative totals
  const cumulatives: number[] = [];
  let running = 0;
  for (const bucket of series) {
    running += Number(bucket.total.toString());
    cumulatives.push(running);
  }

  const maxVal = Math.max(...cumulatives, 1);
  const n = series.length;

  const isEmpty = cumulatives.every((v) => v === 0);

  if (isEmpty) {
    return null;
  }

  function calcY(val: number): number {
    return PAD_TOP + PLOT_H - (val / maxVal) * PLOT_H;
  }

  const points = cumulatives
    .map((v, i) => {
      const x = n <= 1 ? SVG_W / 2 : (i / (n - 1)) * SVG_W;
      const y = calcY(v);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lastX = n <= 1 ? SVG_W / 2 : SVG_W;
  const lastY = calcY(cumulatives[cumulatives.length - 1] ?? 0);

  return (
    <div
      className="section"
      style={{ borderBottom: "1px solid var(--border)", padding: "var(--sp-3)" }}
    >
      <div
        className="mono"
        style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: 8 }}
      >
        {t("income.work.detail.chart.cumulative")}
      </div>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: SVG_H }}
      >
        <line
          x1="0"
          y1={SVG_H - PAD_BOTTOM}
          x2={SVG_W}
          y2={SVG_H - PAD_BOTTOM}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {n > 1 && (
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            points={points}
          />
        )}
        <circle cx={lastX} cy={lastY} r={3} fill="var(--accent)" />
      </svg>
    </div>
  );
}
