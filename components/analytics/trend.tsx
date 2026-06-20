"use client";

import { useState } from "react";
import { useT, useLocale } from "@/lib/i18n/context";
import { formatShortDate, formatMonthYear } from "@/lib/format/date";
import type { TrendPoint } from "@/lib/data/analytics";
import { monotonePath, monotoneAreaPath } from "@/lib/charts/monotone";
import { bsplinePath, bsplineAreaPath } from "@/lib/charts/bspline";

type CurveMode = "interp" | "approx";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const SVG_W = 560;
const SVG_H = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 24; // space for x-axis labels (rendered outside SVG)
const PAD_LEFT = 0;
const PLOT_H = SVG_H - PAD_TOP - 8;

function calcY(value: number, min: number, range: number): number {
  if (range === 0) return PAD_TOP + PLOT_H / 2;
  return PAD_TOP + PLOT_H - ((value - min) / range) * PLOT_H;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface TrendChartsProps {
  points: TrendPoint[];
  granularity?: "weekly" | "monthly";
  safeUntilDaysNow?: number | null;
}

export function TrendCharts({ points, granularity = "monthly", safeUntilDaysNow }: TrendChartsProps) {
  const t = useT();
  const locale = useLocale();

  // Curve smoothing: interpolation (default, passes through points) vs
  // approximation (B-spline — softer, runs near points). Just for fun.
  const [curve, setCurve] = useState<CurveMode>("interp");
  const linePath = curve === "approx" ? bsplinePath : monotonePath;
  const areaPath = curve === "approx" ? bsplineAreaPath : monotoneAreaPath;

  const isEmpty = points.length === 0;

  // Compute min/max across inflow + outflow + net for shared Y axis
  const allValues = points.flatMap((p) => [
    Number(p.inflowBase),
    Number(p.outflowBase),
    Number(p.netBase),
  ]);
  const maxVal = isEmpty ? 1 : Math.max(...allValues, 0);
  const minVal = isEmpty ? 0 : Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const inflowYs = points.map((p) => calcY(Number(p.inflowBase), minVal, range));
  const outflowYs = points.map((p) => calcY(Number(p.outflowBase), minVal, range));
  const netYs = points.map((p) => calcY(Number(p.netBase), minVal, range));

  const n = points.length;
  const xs = points.map((_, i) => (i / Math.max(n - 1, 1)) * SVG_W);

  // X-axis labels — show first, middle and last
  const labelIndices = n <= 1
    ? [0]
    : n <= 4
      ? points.map((_, i) => i)
      : [0, Math.floor(n / 2), n - 1];

  function bucketLabel(iso: string): string {
    const d = new Date(iso);
    if (granularity === "weekly") {
      // day-month for weekly
      return formatShortDate(d, locale);
    }
    // month-year for monthly
    return formatMonthYear(d, locale);
  }

  // Y-axis tick labels (k-units)
  const yTicks = [maxVal, (maxVal + minVal) / 2, minVal].map((v) => {
    const k = v / 1000;
    return k >= 10 ? `${Math.round(k)}k` : k >= 1 ? `${k.toFixed(1)}k` : `${Math.round(v)}`;
  });

  // Grid line Y positions
  const gridYs = [maxVal, (maxVal + minVal) / 2, minVal].map((v) =>
    calcY(v, minVal, range),
  );

  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("analytics.trends.title")}</b>{" "}
          <span className="dim">· {t("analytics.trends.subtitle")}</span>
        </div>
        {!isEmpty && (
          <div className="trend-hd-right">
            <button
              type="button"
              className="curve-toggle mono"
              data-mode={curve}
              onClick={() => setCurve((c) => (c === "interp" ? "approx" : "interp"))}
              title={t("analytics.trends.curve.title")}
              aria-label={t("analytics.trends.curve.title")}
            >
              <span className="ct-opt" data-on={curve === "approx" ? "true" : "false"}>
                {t("analytics.trends.curve.approx")}
              </span>
              <span className="ct-track" aria-hidden="true">
                <span className="ct-knob" />
              </span>
              <span className="ct-opt" data-on={curve === "interp" ? "true" : "false"}>
                {t("analytics.trends.curve.interp")}
              </span>
            </button>
            <span className="meta mono">{yTicks[0]}</span>
          </div>
        )}
      </div>

      <div className="section-body flush">
        {isEmpty ? (
          <div
            className="mono dim"
            style={{
              padding: "var(--sp-4) var(--sp-3)",
              fontSize: "var(--text-sm)",
              textAlign: "center",
            }}
          >
            {t("analytics.trends.empty")}
          </div>
        ) : (
          <div className="trend">
            <div className="trend-cell" style={{ flex: "1 1 0", minWidth: 0 }}>
              {/* Legend */}
              <div className="lbl">
                <span>
                  <span style={{ color: "var(--pos)" }}>▪</span>{" "}
                  {t("analytics.trends.legend.income")}
                  {"  "}
                  <span style={{ color: "var(--neg)" }}>▪</span>{" "}
                  {t("analytics.trends.legend.expense")}
                </span>
                <span className="mono" style={{ color: "var(--accent)" }}>
                  <span style={{ color: "var(--accent)" }}>▪</span>{" "}
                  {t("analytics.trends.legend.net")}
                </span>
              </div>

              {/* Chart */}
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
                {/* Grid lines */}
                <g stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke">
                  {gridYs.map((gy, i) => (
                    <line key={i} x1="0" y1={gy.toFixed(1)} x2={SVG_W} y2={gy.toFixed(1)} vectorEffect="non-scaling-stroke" />
                  ))}
                </g>

                {/* Inflow fill + line */}
                {n > 1 && (
                  <path
                    d={areaPath(xs, inflowYs, SVG_H)}
                    style={{ fill: "var(--pos-fill)" }}
                    stroke="none"
                  />
                )}
                <path
                  d={linePath(xs, inflowYs)}
                  fill="none"
                  stroke="var(--pos)"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Outflow fill + line */}
                {n > 1 && (
                  <path
                    d={areaPath(xs, outflowYs, SVG_H)}
                    style={{ fill: "var(--neg-fill)" }}
                    stroke="none"
                  />
                )}
                <path
                  d={linePath(xs, outflowYs)}
                  fill="none"
                  stroke="var(--neg)"
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Net line */}
                <path
                  d={linePath(xs, netYs)}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.8}
                  strokeDasharray="4 2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Dot at last net point */}
                {n >= 1 && (
                  <circle
                    cx={SVG_W}
                    cy={netYs[n - 1].toFixed(1)}
                    r={3}
                    fill="var(--accent)"
                  />
                )}
              </svg>

              {/* X-axis labels */}
              <div className="foot">
                {labelIndices.map((idx) => (
                  <span
                    key={idx}
                    className={idx === n - 1 ? "acc" : undefined}
                  >
                    {bucketLabel(points[idx].bucketStart)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
