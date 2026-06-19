import { getT } from "@/lib/i18n/server";
import type { FreelanceLatencyKpis } from "@/lib/data/work-sources";

interface Props {
  kpis: FreelanceLatencyKpis;
}

function streakClass(streak: number): string {
  if (streak === 0) return "v pos";
  if (streak >= 3) return "v neg";
  return "v warn";
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
        <div className="kpi">
          <div className="c">{t("income.work.detail.kpi.avg_days_to_pay")}</div>
          <div className="v">{avgFmt}</div>
        </div>

        <div className="kpi">
          <div className="c">{t("income.work.detail.kpi.late_streak")}</div>
          <div className={streakClass(kpis.latePaymentStreak)}>{kpis.latePaymentStreak}</div>
        </div>
      </div>
    </div>
  );
}
