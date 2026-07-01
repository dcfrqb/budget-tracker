import { getT } from "@/lib/i18n/server";
import { monotonePath } from "@/lib/charts/monotone";
import type { BusinessForecast } from "@/lib/data/businesses";

interface Props {
  forecast: BusinessForecast;
}

const SVG_W = 560;
const SVG_H = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;

function calcY(value: number, min: number, range: number): number {
  if (range === 0) return PAD_TOP + PLOT_H / 2;
  return PAD_TOP + PLOT_H - ((value - min) / range) * PLOT_H;
}

export async function ForecastChart({ forecast }: Props) {
  const t = await getT();
  const { history, projection } = forecast;

  if (history.length === 0) return null;

  if (projection.length === 0) {
    return (
      <div className="section fade-in" style={{ animationDelay: "160ms" }}>
        <div className="section-hd">
          <div className="ttl mono">
            <b>{t("business.detail.charts.forecast.title")}</b>
          </div>
        </div>
        <div className="section-body flush">
          <div
            className="mono dim"
            style={{ padding: "var(--sp-4) var(--sp-3)", fontSize: "var(--text-sm)", textAlign: "center" }}
          >
            {t("business.detail.charts.forecast.empty")}
          </div>
        </div>
      </div>
    );
  }

  const totalPoints = history.length + projection.length;

  const allValues = [
    ...history.map((h) => h.revenue),
    ...history.map((h) => h.expenses),
    ...projection.map((p) => p.base),
    ...projection.map((p) => p.optimist),
    ...projection.map((p) => p.pessimist),
    ...projection.map((p) => p.expenses),
    0,
  ];
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const xAt = (i: number) => (i / Math.max(totalPoints - 1, 1)) * SVG_W;

  const historyXs = history.map((_, i) => xAt(i));
  const historyRevYs = history.map((h) => calcY(h.revenue, minVal, range));
  const historyExpYs = history.map((h) => calcY(h.expenses, minVal, range));

  const seamX = xAt(history.length - 1);

  const projXs = projection.map((_, i) => xAt(history.length + i));
  // Scenario/expenses lines connect from the last history point.
  const baseXs = [historyXs[historyXs.length - 1], ...projXs];
  const baseYs = [historyRevYs[historyRevYs.length - 1], ...projection.map((p) => calcY(p.base, minVal, range))];
  const optimistYs = [historyRevYs[historyRevYs.length - 1], ...projection.map((p) => calcY(p.optimist, minVal, range))];
  const pessimistYs = [historyRevYs[historyRevYs.length - 1], ...projection.map((p) => calcY(p.pessimist, minVal, range))];
  const expYs = [historyExpYs[historyExpYs.length - 1], ...projection.map((p) => calcY(p.expenses, minVal, range))];

  const labelKeys = [...history.map((h) => h.monthKey), ...projection.map((p) => p.monthKey)];
  const n = labelKeys.length;
  const labelIndices = n <= 4 ? labelKeys.map((_, i) => i) : [0, Math.floor((history.length - 1) / 1), Math.floor(n / 2), n - 1];
  const uniqueLabelIndices = Array.from(new Set(labelIndices)).sort((a, b) => a - b);

  return (
    <div className="section fade-in" style={{ animationDelay: "160ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("business.detail.charts.forecast.title")}</b>
        </div>
      </div>
      <div className="section-body flush">
        <div className="trend">
          <div className="trend-cell" style={{ flex: "1 1 0", minWidth: 0 }}>
            <div className="lbl">
              <span>
                <span style={{ color: "var(--accent)" }}>▪</span> {t("business.detail.charts.forecast.legend_history")}
                {"  "}
                <span style={{ color: "var(--warn)" }}>▪</span> {t("business.detail.charts.forecast.legend_expenses")}
              </span>
              <span className="mono">
                <span style={{ color: "var(--accent)" }}>▪</span> {t("business.detail.charts.forecast.scenario_base")}{"  "}
                <span style={{ color: "var(--pos)" }}>▪</span> {t("business.detail.charts.forecast.scenario_optimist")}{"  "}
                <span style={{ color: "var(--neg)" }}>▪</span> {t("business.detail.charts.forecast.scenario_pessimist")}
              </span>
            </div>

            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
              <g stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke">
                <line x1="0" y1={PAD_TOP} x2={SVG_W} y2={PAD_TOP} vectorEffect="non-scaling-stroke" />
                <line x1="0" y1={PAD_TOP + PLOT_H} x2={SVG_W} y2={PAD_TOP + PLOT_H} vectorEffect="non-scaling-stroke" />
              </g>

              {/* Seam divider between history and projection */}
              <line
                x1={seamX.toFixed(1)}
                y1={PAD_TOP}
                x2={seamX.toFixed(1)}
                y2={PAD_TOP + PLOT_H}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />

              {/* Historical revenue — solid accent */}
              {history.length > 1 && (
                <path
                  d={monotonePath(historyXs, historyRevYs)}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Historical expenses — solid warn */}
              {history.length > 1 && (
                <path
                  d={monotonePath(historyXs, historyExpYs)}
                  fill="none"
                  stroke="var(--warn)"
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Projected expenses — dashed warn */}
              <path
                d={monotonePath(baseXs, expYs)}
                fill="none"
                stroke="var(--warn)"
                strokeWidth={1.4}
                strokeDasharray="4 2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Scenario lines — dashed */}
              <path
                d={monotonePath(baseXs, pessimistYs)}
                fill="none"
                stroke="var(--neg)"
                strokeWidth={1.4}
                strokeDasharray="4 2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={monotonePath(baseXs, baseYs)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.6}
                strokeDasharray="4 2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={monotonePath(baseXs, optimistYs)}
                fill="none"
                stroke="var(--pos)"
                strokeWidth={1.4}
                strokeDasharray="4 2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="foot">
              {uniqueLabelIndices.map((idx) => (
                <span key={idx} className={idx === n - 1 ? "acc" : undefined}>
                  {labelKeys[idx]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
