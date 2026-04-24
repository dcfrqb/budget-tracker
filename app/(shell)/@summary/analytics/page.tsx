import { CountUp } from "@/components/count-up";
import {
  BalancesBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { Sparkline } from "@/components/shell/sparkline";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { resolveRange, getPeriodKpis, getPeriodCompare, getWeather } from "@/lib/data/analytics";
import { Prisma } from "@prisma/client";
import { formatRubPrefix } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server";

const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

export default async function AnalyticsSummary() {
  const now = new Date();
  const range3m = resolveRange("3m");
  const range1m = resolveRange("1m");

  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));

  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonthLabel = monthShort[prevMonthDate.getUTCMonth()];
  const curMonthLabel = monthShort[now.getUTCMonth()];

  const [kpis3m, compare1m, weather] = await Promise.all([
    getPeriodKpis(userId, range3m, DEFAULT_CURRENCY),
    getPeriodCompare(userId, range1m, DEFAULT_CURRENCY),
    getWeather(userId, DEFAULT_CURRENCY),
  ]);

  const net3m = new Prisma.Decimal(kpis3m.netBase);
  const avgNet3m = net3m.div(3);

  const topDeltas = compare1m
    .filter((r) => r.deltaPct !== null)
    .sort((a, b) => Math.abs(b.deltaPct!) - Math.abs(a.deltaPct!))
    .slice(0, 5)
    .map((r) => ({
      k: r.categoryName,
      v: r.deltaPct! > 0
        ? `\u25b2 ${Math.abs(r.deltaPct!).toFixed(1)}%`
        : `\u25bc ${Math.abs(r.deltaPct!).toFixed(1)}%`,
      tone: r.deltaPct! > 0 ? ("neg" as const) : ("pos" as const),
    }));

  const weatherKey = weather.kind as "sun" | "cloud" | "rain" | "storm";
  const wxLabel = t(`summary.analytics.weather_${weatherKey}` as Parameters<typeof t>[0]) ?? "\u2014";
  const savingsStr = weather.savingsRatePct !== null
    ? `${weather.savingsRatePct.toFixed(0)}%`
    : t("summary.analytics.no_data");

  return (
    <SummaryShell>
      <div className="sum-block" style={{ padding: "12px 8px" }}>
        <div className="period-hero">
          <div className="lbl">
            <span>{t("summary.analytics.period_label")}</span>
            <span className="tiny">{prevMonthLabel} &ndash; {curMonthLabel}</span>
          </div>
          <div className="row">
            <span className="big mono"><CountUp to={Math.abs(Number(avgNet3m.toFixed(0)))} /></span>
            <span className="unit mono">{t("summary.analytics.avg_net_unit")}</span>
          </div>
          <div className="sub mono">
            {t("summary.analytics.avg_net_sub")} &middot;{" "}
            <span className={net3m.gte(0) ? "acc" : "neg"}>
              {net3m.gte(0) ? "+" : "\u2212"}{formatRubPrefix(net3m.abs())}
            </span>
          </div>
        </div>
      </div>

      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.analytics.weather_label")}</span>
          <span className="tiny mono">{wxLabel}</span>
        </div>
        <div className="period-stats">
          <div className="r"><span className="k">{t("summary.analytics.savings_key")}</span><span className="v pos">{savingsStr}</span></div>
          <div className="r"><span className="k">{t("summary.analytics.status_key")}</span><span className="v acc">{wxLabel}</span></div>
        </div>
      </div>

      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.analytics.delta_label")}</span>
          <span className="tiny mono">{prevMonthLabel} vs {curMonthLabel}</span>
        </div>
        <div className="period-stats">
          {topDeltas.map((d, i) => (
            <div key={i} className="r">
              <span className="k">{d.k}</span>
              <span className={`v ${d.tone}`}>{d.v}</span>
            </div>
          ))}
          {topDeltas.length === 0 && (
            <div className="r"><span className="k">{t("summary.analytics.no_data")}</span></div>
          )}
        </div>
      </div>

      <BalancesBlock />

      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.analytics.flow_label")}</span>
          <span className="tiny mono">{t("summary.analytics.flow_meta")}</span>
        </div>
        {/* TODO: pass real cashflow points when historical data is available */}
        <Sparkline points={[]} />
      </div>

      <SessionStateBlock
        rows={[
          { tone: "pos", k: t("summary.analytics.mode_key"), v: t("summary.analytics.mode_val"), vClass: "pos" },
          { tone: "pos", k: t("summary.analytics.view_key"), v: t("summary.analytics.view_val"), vClass: "acc" },
          { tone: weather.kind === "sun" || weather.kind === "cloud" ? "pos" : "warn", k: t("summary.analytics.weather_key"), v: wxLabel, vClass: weather.kind === "sun" ? "acc" : "warn" },
        ]}
      />
    </SummaryShell>
  );
}
