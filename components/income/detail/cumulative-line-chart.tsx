"use client";

import { useT } from "@/lib/i18n/context";
import type { WorkSourceMonthlyBucket } from "@/lib/data/work-sources";

const SVG_W = 560;
const SVG_H = 100;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;

interface Props {
  series: WorkSourceMonthlyBucket[];
  sourceCcy: string;
}

export function CumulativeLineChart({ series, sourceCcy }: Props) {
  const t = useT();
  void sourceCcy;

  const cumulatives: number[] = [];
  let running = 0;
  for (const bucket of series) {
    running += Number(bucket.total.toString());
    cumulatives.push(running);
  }

  const maxVal = Math.max(...cumulatives, 1);
  const n = series.length;
  const isNarrow = n > 4;

  const isEmpty = cumulatives.every((v) => v === 0);

  if (isEmpty) {
    return null;
  }

  function calcY(val: number): number {
    return PAD_TOP + PLOT_H - (val / maxVal) * PLOT_H;
  }

  function shortMonthLabel(key: string, narrow: boolean): string {
    const [yr, mo] = key.split("-");
    const month = parseInt(mo, 10);
    const abbrev = t(`common.month.short.${month}` as Parameters<typeof t>[0]);
    if (narrow) return abbrev.charAt(0);
    return `${abbrev} ${yr?.slice(2)}`;
  }

  const xyPairs: { x: number; y: number }[] = cumulatives.map((v, i) => ({
    x: n <= 1 ? SVG_W / 2 : (i / (n - 1)) * SVG_W,
    y: calcY(v),
  }));

  const points = xyPairs.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const baselineY = SVG_H - PAD_BOTTOM;
  const firstX = xyPairs[0]?.x ?? 0;
  const lastX = xyPairs[xyPairs.length - 1]?.x ?? SVG_W;

  const areaPoints = [
    `${firstX.toFixed(1)},${baselineY}`,
    ...xyPairs.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${lastX.toFixed(1)},${baselineY}`,
  ].join(" ");

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
          y1={baselineY}
          x2={SVG_W}
          y2={baselineY}
          stroke="var(--border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {n > 1 && (
          <polygon
            points={areaPoints}
            fill="color-mix(in srgb, var(--accent) 12%, transparent)"
            stroke="none"
          />
        )}
        {n > 1 && (
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            points={points}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--mono-font), monospace",
          fontSize: "var(--text-2xs)",
          color: "var(--dim)",
          marginTop: 4,
        }}
      >
        {series.map((bucket) => (
          <span key={bucket.monthKey}>{shortMonthLabel(bucket.monthKey, isNarrow)}</span>
        ))}
      </div>
    </div>
  );
}
