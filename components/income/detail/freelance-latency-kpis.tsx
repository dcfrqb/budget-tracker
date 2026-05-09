import { getT } from "@/lib/i18n/server";
import type { FreelanceLatencyKpis } from "@/lib/data/work-sources";

interface Props {
  kpis: FreelanceLatencyKpis;
}

function streakColor(streak: number): string {
  if (streak === 0) return "var(--pos)";
  if (streak >= 3) return "var(--neg)";
  return "var(--warn)";
}

export async function FreelanceLatencyKpisBlock({ kpis }: Props) {
  const t = await getT();

  const avgFmt =
    kpis.avgDaysToPay != null
      ? `${kpis.avgDaysToPay.toLocaleString("en", { maximumFractionDigits: 1 })} ${t("income.work.detail.kpi.days_unit")}`
      : "—";

  return (
    <div
      className="ws-detail"
      style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="freelance-extras">
        <div
          style={{
            padding: "var(--sp-3)",
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t("income.work.detail.kpi.avg_days_to_pay")}
          </div>
          <div
            className="mono"
            style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text)" }}
          >
            {avgFmt}
          </div>
        </div>

        <div
          style={{
            padding: "var(--sp-3)",
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t("income.work.detail.kpi.late_streak")}
          </div>
          <div
            className="mono"
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              color: streakColor(kpis.latePaymentStreak),
            }}
          >
            {kpis.latePaymentStreak}
          </div>
        </div>
      </div>
    </div>
  );
}
