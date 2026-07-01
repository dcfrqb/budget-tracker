import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { resolveStreamLabel } from "@/lib/format/business-labels";
import { BUSINESS_CHART_COLORS } from "@/lib/charts/business-colors";
import type { BusinessStreamMatrix } from "@/lib/data/businesses";

interface Props {
  matrix: BusinessStreamMatrix;
  currencyCode: string;
}

const SVG_W = 560;
const SVG_H = 160;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;
const BAR_GAP = 6;

export async function StreamChart({ matrix, currencyCode }: Props) {
  const t = await getT();

  if (matrix.streams.length === 0) return null;

  const months = matrix.months;
  const n = months.length;
  if (n === 0) return null;

  const maxTotal = Math.max(...months.map((m) => Number(matrix.monthTotals[m])), 0);
  const barW = SVG_W / n - BAR_GAP;

  return (
    <div className="section fade-in" style={{ animationDelay: "100ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("business.detail.charts.stream.title")}</b>
        </div>
      </div>
      <div className="section-body flush">
        <div className="trend">
          <div className="trend-cell" style={{ flex: "1 1 0", minWidth: 0 }}>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
              <g stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke">
                <line x1="0" y1={PAD_TOP} x2={SVG_W} y2={PAD_TOP} vectorEffect="non-scaling-stroke" />
                <line
                  x1="0"
                  y1={PAD_TOP + PLOT_H}
                  x2={SVG_W}
                  y2={PAD_TOP + PLOT_H}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
              {maxTotal > 0 &&
                months.map((m, i) => {
                  const x = i * (barW + BAR_GAP) + BAR_GAP / 2;
                  let yCursor = PAD_TOP + PLOT_H;
                  return (
                    <g key={m}>
                      {matrix.streams.map((stream, si) => {
                        const v = Number(matrix.cells[stream][m]);
                        if (v <= 0) return null;
                        const h = (v / maxTotal) * PLOT_H;
                        yCursor -= h;
                        return (
                          <rect
                            key={stream}
                            x={x.toFixed(1)}
                            y={yCursor.toFixed(1)}
                            width={barW.toFixed(1)}
                            height={h.toFixed(1)}
                            fill={BUSINESS_CHART_COLORS[si % BUSINESS_CHART_COLORS.length]}
                          />
                        );
                      })}
                    </g>
                  );
                })}
            </svg>
            <div className="foot">
              {months.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="stream-chart-legend" style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)", padding: "var(--sp-3)" }}>
          {matrix.streams.map((stream, si) => (
            <div key={stream} className="mono" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-xs)" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  background: BUSINESS_CHART_COLORS[si % BUSINESS_CHART_COLORS.length],
                }}
              />
              <span style={{ color: "var(--text)" }}>{resolveStreamLabel(t, stream)}</span>
              <span style={{ color: "var(--muted)" }}>
                {formatMoney(matrix.streamTotals[stream], currencyCode)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
