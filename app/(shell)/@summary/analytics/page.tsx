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
import {
  parseAnalyticsPeriod,
  parseAnalyticsCompare,
  resolveCompareRange,
  formatPeriodLabel,
  periodShortLabel,
  periodMonthCount,
} from "@/lib/analytics/period";
import { Prisma } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server";

type SearchParams = Promise<{ p?: string; cmp?: string }>;

export default async function AnalyticsSummary({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = searchParams ? await searchParams : {};
  const period = parseAnalyticsPeriod(sp.p);
  const compareMode = parseAnalyticsCompare(sp.cmp);

  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const currentRange = resolveRange(period);
  const compareRange = resolveCompareRange(currentRange, compareMode);

  const periodShort = periodShortLabel(period, t);
  const monthCount = periodMonthCount(period, currentRange);

  const [kpis, compareRows, weather] = await Promise.all([
    getPeriodKpis(userId, currentRange, DEFAULT_CURRENCY),
    getPeriodCompare(userId, currentRange, DEFAULT_CURRENCY, compareRange),
    getWeather(userId, DEFAULT_CURRENCY),
  ]);

  const net = new Prisma.Decimal(kpis.netBase);
  const avgNet = net.div(monthCount);

  const currentPeriodLabel = formatPeriodLabel(currentRange, t);
  const comparePeriodLabel = compareRange ? formatPeriodLabel(compareRange, t) : null;

  const topDeltas = compareRows
    .filter((r) => r.deltaPct !== null)
    .sort((a, b) => Math.abs(b.deltaPct!) - Math.abs(a.deltaPct!))
    .slice(0, 5)
    .map((r) => ({
      k: r.categoryName,
      v: r.deltaPct! > 0
        ? `▲ ${Math.abs(r.deltaPct!).toFixed(1)}%`
        : `▼ ${Math.abs(r.deltaPct!).toFixed(1)}%`,
      tone: r.deltaPct! > 0 ? ("neg" as const) : ("pos" as const),
    }));

  const weatherKey = weather.kind as "sun" | "cloud" | "rain" | "storm";
  const wxLabel = t(`summary.analytics.weather_${weatherKey}` as Parameters<typeof t>[0]) ?? "—";
  const savingsStr = weather.savingsRatePct !== null
    ? `${weather.savingsRatePct.toFixed(0)}%`
    : t("summary.analytics.no_data");

  const deltaRangeLabel = comparePeriodLabel
    ? `${comparePeriodLabel} vs ${currentPeriodLabel}`
    : currentPeriodLabel;

  return (
    <SummaryShell>
      <div className="sum-block" style={{ padding: "12px 8px" }}>
        <div className="period-hero">
          <div className="lbl">
            <span>{t("summary.analytics.period_label", { vars: { period: periodShort } })}</span>
            <span className="tiny">{currentPeriodLabel}</span>
          </div>
          <div className="row">
            <span className="big mono"><CountUp to={Math.abs(Number(avgNet.toFixed(0)))} /></span>
            <span className="unit mono">{t("summary.analytics.avg_net_unit")}</span>
          </div>
          <div className="sub mono">
            {t("summary.analytics.avg_net_sub")} &middot;{" "}
            <span className={net.gte(0) ? "acc" : "neg"}>
              {net.gte(0) ? "+" : "−"}{formatMoney(net.abs(), "RUB")}
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
          <span className="tiny mono">{deltaRangeLabel}</span>
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
          <span>{t("summary.analytics.flow_label", { vars: { period: periodShort } })}</span>
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
