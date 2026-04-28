import { AnalyticsKpiRow } from "@/components/analytics/kpi-row";
import { AnalyticsStatusStrip } from "@/components/analytics/status-strip";
import { parseAnalyticsPeriod, DEFAULT_ANALYTICS_PERIOD } from "@/lib/analytics/period";
import { CategoryPie } from "@/components/analytics/category-pie";
import { Compare } from "@/components/analytics/compare";
import { Forecast } from "@/components/analytics/forecast";
import { ModesReference } from "@/components/analytics/modes-reference";
import { RunwayByMode } from "@/components/analytics/runway-by-mode";
import { TrendCharts } from "@/components/analytics/trend";
import { Weather } from "@/components/analytics/weather";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  resolveRange,
  getPeriodKpis,
  getCategoryPie,
  getPeriodCompare,
  getForecastMonth,
  getWeather,
  getTrendPoints,
} from "@/lib/data/analytics";
import { getRunwayByMode } from "@/lib/data/analytics-runway";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { getT } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { formatRubPrefix } from "@/lib/format/money";
import type { AnalyticsKpiItem } from "@/components/analytics/kpi-row";
import type { PieSliceView } from "@/components/analytics/category-pie";
import type { CompareRow } from "@/components/analytics/compare";
import type { ForecastCell } from "@/components/analytics/forecast";
import type { ModeCard } from "@/components/analytics/modes-reference";

export const dynamic = "force-dynamic";

const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

const BAR_COLORS = [
  "var(--warn)", "var(--info)", "var(--accent)",
  "var(--pos)", "var(--neg)", "var(--chart-7)", "var(--chart-6)", "var(--chart-5)",
];

// Period → days mapping for resolveRange.
// Granularity: 1m uses weekly buckets (more detail), others use monthly.
function trendGranularity(period: string): "weekly" | "monthly" {
  return period === "1m" ? "weekly" : "monthly";
}

function periodToResolvable(period: string): "1m" | "3m" | "6m" | "12m" {
  if (period === "1m") return "1m";
  if (period === "6m") return "6m";
  if (period === "12m") return "12m";
  // TODO: add native YTD support in resolveRange (currently aliased to 12m which is incorrect for January-March)
  if (period === "ytd") return "12m";
  return "3m"; // default for "3m" and unknown
}

type SearchParams = Promise<{ p?: string }>;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const sp = searchParams ? await searchParams : {};
  const trendPeriodRaw = sp.p ?? DEFAULT_ANALYTICS_PERIOD;
  const trendPeriod = parseAnalyticsPeriod(trendPeriodRaw);
  const trendRange = resolveRange(periodToResolvable(trendPeriod));
  const granularity = trendGranularity(trendPeriod);

  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));

  const now = new Date();
  const range3m = resolveRange("3m");
  const range1m = resolveRange("1m");

  const currentMonthLabel = `${monthShort[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonthLabel = `${monthShort[prevMonthDate.getUTCMonth()]} ${prevMonthDate.getUTCFullYear()}`;

  const [kpis3m, pie1m, compare1m, forecast, weather, budgetSettings, runwayDashboard, trendPoints, homeDash] = await Promise.all([
    getPeriodKpis(userId, range3m, DEFAULT_CURRENCY),
    getCategoryPie(userId, range1m, DEFAULT_CURRENCY),
    getPeriodCompare(userId, range1m, DEFAULT_CURRENCY),
    getForecastMonth(userId, DEFAULT_CURRENCY),
    getWeather(userId, DEFAULT_CURRENCY),
    db.budgetSettings.findUnique({ where: { userId } }),
    getRunwayByMode(userId, DEFAULT_CURRENCY),
    getTrendPoints(userId, trendRange, DEFAULT_CURRENCY, granularity),
    getHomeDashboard(userId, DEFAULT_CURRENCY),
  ]);

  const safeUntilDays = homeDash.safeUntilDays;

  // ── KPI items ────────────────────────────────────────────────
  const inflow3m = new Prisma.Decimal(kpis3m.inflowBase);
  const outflow3m = new Prisma.Decimal(kpis3m.outflowBase);
  const net3m = new Prisma.Decimal(kpis3m.netBase);

  const periodFromLabel = (() => {
    const d = new Date(range3m.from);
    return `${monthShort[d.getUTCMonth()]} — ${currentMonthLabel}`;
  })();

  const kpiItems: AnalyticsKpiItem[] = [
    {
      k: t("analytics.kpi.income_3m"),
      v: Number(inflow3m.toFixed(0)),
      vFormat: "money",
      delta: kpis3m.savingsRatePct !== null
        ? t("analytics.kpi.savings_rate", { vars: { pct: kpis3m.savingsRatePct.toFixed(1) } })
        : t("analytics.kpi.no_data"),
      deltaTone: (kpis3m.savingsRatePct ?? 0) >= 20 ? "pos" : "warn",
      s: t("analytics.kpi.income_sub"),
      c: "pos",
    },
    {
      k: t("analytics.kpi.expense_3m"),
      v: Number(outflow3m.toFixed(0)),
      vFormat: "money",
      delta: "",
      deltaTone: "muted",
      s: t("analytics.kpi.expense_sub"),
      c: "neg",
    },
    {
      k: t("analytics.kpi.net_3m"),
      v: Math.abs(Number(net3m.toFixed(0))),
      vFormat: net3m.gte(0) ? "money-pos" : "money-neg",
      delta: net3m.gte(0) ? t("analytics.kpi.net_sub_pos") : t("analytics.kpi.net_sub_neg"),
      deltaTone: net3m.gte(0) ? "pos" : "neg",
      s: t("analytics.kpi.net_sub"),
      c: net3m.gte(0) ? "pos" : "neg",
    },
  ];

  // ── Pie slices ───────────────────────────────────────────────
  const pieTotal = pie1m.reduce((s, sl) => s.plus(sl.amountBase), new Prisma.Decimal(0));

  const pieSlices: PieSliceView[] = pie1m.slice(0, 8).map((sl, i) => ({
    name: sl.categoryName,
    sub: sl.icon ?? "",
    amount: formatRubPrefix(new Prisma.Decimal(sl.amountBase)),
    pct: sl.pct,
    color: BAR_COLORS[i % BAR_COLORS.length],
    delta: "",
    deltaTone: "muted",
  }));

  // ── Compare rows ─────────────────────────────────────────────
  const compareRows: CompareRow[] = compare1m
    .sort((a, b) => new Prisma.Decimal(b.currentBase).comparedTo(new Prisma.Decimal(a.currentBase)))
    .slice(0, 10)
    .map((r) => {
      const deltaPct = r.deltaPct;
      const deltaStr = deltaPct === null
        ? "—"
        : deltaPct > 0
          ? `▲ ${Math.abs(deltaPct).toFixed(1)}%`
          : `▼ ${Math.abs(deltaPct).toFixed(1)}%`;
      const deltaTone = deltaPct === null ? "muted" : deltaPct > 0 ? "neg" : "pos";
      return {
        name: r.categoryName,
        sub: "",
        prev: formatRubPrefix(new Prisma.Decimal(r.previousBase)),
        curr: formatRubPrefix(new Prisma.Decimal(r.currentBase)),
        delta: deltaStr,
        deltaTone,
        spark: [],
      };
    });

  // ── Forecast cells ───────────────────────────────────────────
  const fcInflow = new Prisma.Decimal(forecast.inflowExpectedBase);
  const fcOutflow = new Prisma.Decimal(forecast.outflowExpectedBase);
  const fcNet = new Prisma.Decimal(forecast.netExpectedBase);

  const forecastCells: ForecastCell[] = [
    {
      k: t("analytics.forecast.income"),
      v: formatRubPrefix(fcInflow),
      s: t("analytics.forecast.sub_plan"),
      vTone: "pos",
    },
    {
      k: t("analytics.forecast.expense"),
      v: formatRubPrefix(fcOutflow),
      s: t("analytics.forecast.sub_plan"),
      vTone: "",
    },
    {
      k: t("analytics.forecast.net"),
      v: formatRubPrefix(fcNet),
      s: fcNet.gte(0) ? t("analytics.forecast.net_pos") : t("analytics.forecast.net_neg"),
      vTone: fcNet.gte(0) ? "pos" : "neg",
    },
  ];

  // ── Modes ────────────────────────────────────────────────────
  const activeMode = budgetSettings?.activeMode ?? "NORMAL";
  const activeModeLabel = t(`analytics.mode.${activeMode}` as Parameters<typeof t>[0]);

  const STATIC_MODES: ModeCard[] = [
    {
      id: "lean",
      name: t("analytics.mode.ECONOMY"),
      tag: t("analytics.mode.economy_tag"),
      active: activeMode === "ECONOMY",
      limits: [
        { k: t("analytics.mode.limit_key"), v: t("analytics.mode.limit_lean") },
      ],
      safeDays: "—",
      safeColor: "var(--accent)",
    },
    {
      id: "norm",
      name: t("analytics.mode.NORMAL"),
      tag: t("analytics.mode.normal_tag"),
      active: activeMode === "NORMAL",
      limits: [
        { k: t("analytics.mode.limit_key"), v: t("analytics.mode.limit_normal") },
      ],
      safeDays: "—",
      safeColor: "var(--pos)",
    },
    {
      id: "free",
      name: t("analytics.mode.FREE"),
      tag: t("analytics.mode.free_tag"),
      active: activeMode === "FREE",
      limits: [
        { k: t("analytics.mode.limit_key"), v: t("analytics.mode.limit_free") },
      ],
      safeDays: "—",
      safeColor: "var(--info)",
    },
  ];

  return (
    <>
      <AnalyticsStatusStrip />
      <Weather
        kind={weather.kind}
        savingsRatePct={weather.savingsRatePct}
        reason={weather.reason}
      />
      <AnalyticsKpiRow items={kpiItems} periodLabel={periodFromLabel} />
      <TrendCharts points={trendPoints} granularity={granularity} safeUntilDaysNow={safeUntilDays} />
      <CategoryPie
        slices={pieSlices}
        totalLabel={formatRubPrefix(pieTotal)}
        periodLabel={currentMonthLabel}
      />
      <Compare
        rows={compareRows}
        currentPeriodLabel={currentMonthLabel}
        previousPeriodLabel={prevMonthLabel}
      />
      <Forecast cells={forecastCells} />
      <RunwayByMode data={runwayDashboard} defaultMode={activeMode} />
      <ModesReference modes={STATIC_MODES} activeMode={activeModeLabel} />
    </>
  );
}
