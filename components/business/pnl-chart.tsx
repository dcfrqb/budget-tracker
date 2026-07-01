import { getT } from "@/lib/i18n/server";
import { monotonePath } from "@/lib/charts/monotone";
import type { BusinessPnLRow } from "@/lib/data/businesses";

interface Props {
  rows: BusinessPnLRow[];
}

const SVG_W = 560;
const SVG_H = 160;
const PAD_TOP = 10;
const PAD_BOTTOM = 6;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;
const BAR_GAP = 6;

function calcY(value: number, min: number, range: number): number {
  if (range === 0) return PAD_TOP + PLOT_H / 2;
  return PAD_TOP + PLOT_H - ((value - min) / range) * PLOT_H;
}

export async function PnLChart({ rows }: Props) {
  const t = await getT();

  if (rows.length === 0) return null;

  const n = rows.length;
  const revenues = rows.map((r) => Number(r.revenue));
  const expenses = rows.map((r) => Number(r.expenses));
  const cumulative = rows.map((r) => Number(r.cumulativeProfit));

  const barMax = Math.max(...revenues, ...expenses, 0);
  const cumMax = Math.max(...cumulative, 0);
  const cumMin = Math.min(...cumulative, 0);
  const cumRange = cumMax - cumMin || 1;

  const groupW = SVG_W / n;
  const barW = (groupW - BAR_GAP * 3) / 2;

  const zeroY = calcY(0, cumMin, cumRange);
  const xs = rows.map((_, i) => groupW * i + groupW / 2);
  const cumYs = cumulative.map((v) => calcY(v, cumMin, cumRange));

  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("business.detail.charts.pnl.title")}</b>
        </div>
      </div>
      <div className="section-body flush">
        <div className="trend">
          <div className="trend-cell" style={{ flex: "1 1 0", minWidth: 0 }}>
            <div className="lbl">
              <span>
                <span style={{ color: "var(--pos)" }}>▪</span> {t("business.detail.charts.pnl.legend_revenue")}
                {"  "}
                <span style={{ color: "var(--warn)" }}>▪</span> {t("business.detail.charts.pnl.legend_expenses")}
              </span>
              <span className="mono" style={{ color: "var(--accent)" }}>
                <span style={{ color: "var(--accent)" }}>▪</span> {t("business.detail.charts.pnl.legend_cumulative")}
              </span>
            </div>

            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
              <g stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke">
                <line x1="0" y1={zeroY.toFixed(1)} x2={SVG_W} y2={zeroY.toFixed(1)} vectorEffect="non-scaling-stroke" />
              </g>

              {barMax > 0 &&
                rows.map((row, i) => {
                  const groupX = groupW * i + BAR_GAP;
                  const revH = (revenues[i] / barMax) * PLOT_H;
                  const expH = (expenses[i] / barMax) * PLOT_H;
                  return (
                    <g key={row.monthKey}>
                      <rect
                        x={groupX.toFixed(1)}
                        y={(PAD_TOP + PLOT_H - revH).toFixed(1)}
                        width={barW.toFixed(1)}
                        height={revH.toFixed(1)}
                        fill="var(--pos)"
                      />
                      <rect
                        x={(groupX + barW + BAR_GAP).toFixed(1)}
                        y={(PAD_TOP + PLOT_H - expH).toFixed(1)}
                        width={barW.toFixed(1)}
                        height={expH.toFixed(1)}
                        fill="var(--warn)"
                      />
                    </g>
                  );
                })}

              {n > 1 && (
                <path
                  d={monotonePath(xs, cumYs)}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.8}
                  strokeDasharray="4 2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              <circle cx={xs[n - 1].toFixed(1)} cy={cumYs[n - 1].toFixed(1)} r={3} fill="var(--accent)" />
            </svg>

            <div className="foot">
              {rows.map((row) => (
                <span key={row.monthKey}>{row.monthKey}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
