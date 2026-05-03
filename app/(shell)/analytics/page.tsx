import { AnalyticsKpiRow } from "@/components/analytics/kpi-row";
import { AnalyticsStatusStrip } from "@/components/analytics/status-strip";
import {
  parseAnalyticsPeriod,
  parseAnalyticsCompare,
  resolveCompareRange,
  formatPeriodLabel,
  periodShortLabel,
} from "@/lib/analytics/period";
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
import { getT, getLocale } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { formatRubPrefix } from "@/lib/format/money";
import type { AnalyticsKpiItem } from "@/components/analytics/kpi-row";
import type { PieSliceView } from "@/components/analytics/category-pie";
import type { CompareRow } from "@/components/analytics/compare";
import type { ForecastCell } from "@/components/analytics/forecast";
import type { ModeCard } from "@/components/analytics/modes-reference";

export const dynamic = "force-dynamic";

const BAR_COLORS = [
  "var(--warn)", "var(--info)", "var(--accent)",
  "var(--pos)", "var(--neg)", "var(--chart-7)", "var(--chart-6)", "var(--chart-5)",
];

// Period → days mapping for resolveRange.
// Granularity: 1m uses weekly buckets (more detail), others use monthly.
function trendGranularity(period: string): "weekly" | "monthly" {
  return period === "1m" ? "weekly" : "monthly";
}


type SearchParams = Promise<{ p?: string; cmp?: string }>;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const [userId, t, locale] = await Promise.all([getCurrentUserId(), getT(), getLocale()]);

  const sp = searchParams ? await searchParams : {};
  const trendPeriod = parseAnalyticsPeriod(sp.p);
  const compareMode = parseAnalyticsCompare(sp.cmp);

  const currentRange = resolveRange(trendPeriod);
  const granularity = trendGranularity(trendPeriod);

  const compareRange = resolveCompareRange(currentRange, compareMode);

  const currentPeriodLabel = formatPeriodLabel(currentRange, locale);
  const previousPeriodLabel = compareRange ? formatPeriodLabel(compareRange, locale) : null;

  const [kpis, pie, compare, forecast, weather, budgetSettings, runwayDashboard, trendPoints, homeDash] = await Promise.all([
    getPeriodKpis(userId, currentRange, DEFAULT_CURRENCY),
    getCategoryPie(userId, currentRange, DEFAULT_CURRENCY),
    getPeriodCompare(userId, currentRange, DEFAULT_CURRENCY, compareRange),
    getForecastMonth(userId, DEFAULT_CURRENCY),
    getWeather(userId, DEFAULT_CURRENCY),
    db.budgetSettings.findUnique({ where: { userId } }),
    getRunwayByMode(userId, DEFAULT_CURRENCY),
    getTrendPoints(userId, currentRange, DEFAULT_CURRENCY, granularity),
    getHomeDashboard(userId, DEFAULT_CURRENCY),
  ]);

  const safeUntilDays = homeDash.safeUntilDays;
  const periodShort = periodShortLabel(trendPeriod, t);

  // ── KPI items ────────────────────────────────────────────────
  const inflow = new Prisma.Decimal(kpis.inflowBase);
  const outflow = new Prisma.Decimal(kpis.outflowBase);
  const net = new Prisma.Decimal(kpis.netBase);

  const kpiItems: AnalyticsKpiItem[] = [
    {
      k: t("analytics.kpi.income_period", { vars: { period: periodShort } }),
      v: Number(inflow.toFixed(0)),
      vFormat: "money",
      delta: kpis.savingsRatePct !== null
        ? t("analytics.kpi.savings_rate", { vars: { pct: kpis.savingsRatePct.toFixed(1) } })
        : t("analytics.kpi.no_data"),
      deltaTone: (kpis.savingsRatePct ?? 0) >= 20 ? "pos" : "warn",
      s: t("analytics.kpi.income_sub"),
      c: "pos",
    },
    {
      k: t("analytics.kpi.expense_period", { vars: { period: periodShort } }),
      v: Number(outflow.toFixed(0)),
      vFormat: "money",
      delta: "",
      deltaTone: "muted",
      s: t("analytics.kpi.expense_sub"),
      c: "neg",
    },
    {
      k: t("analytics.kpi.net_period", { vars: { period: periodShort } }),
      v: Math.abs(Number(net.toFixed(0))),
      vFormat: net.gte(0) ? "money-pos" : "money-neg",
      delta: net.gte(0) ? t("analytics.kpi.net_sub_pos") : t("analytics.kpi.net_sub_neg"),
      deltaTone: net.gte(0) ? "pos" : "neg",
      s: t("analytics.kpi.net_sub"),
      c: net.gte(0) ? "pos" : "neg",
    },
  ];

  // ── Pie slices ───────────────────────────────────────────────
  const pieTotal = pie.reduce((s, sl) => s.plus(sl.amountBase), new Prisma.Decimal(0));

  const pieSlices: PieSliceView[] = pie.slice(0, 8).map((sl, i) => ({
    name: sl.categoryName,
    sub: sl.icon ?? "",
    amount: formatRubPrefix(new Prisma.Decimal(sl.amountBase)),
    pct: sl.pct,
    color: BAR_COLORS[i % BAR_COLORS.length],
    delta: "",
    deltaTone: "muted",
  }));

  // ── Compare rows ─────────────────────────────────────────────
  const compareRows: CompareRow[] = compareMode === "none" ? [] : compare
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

  // ── Compare caption ──────────────────────────────────────────
  const compareCaptionLabel = previousPeriodLabel
    ? t("analytics.compare.range_caption", {
        vars: { currentRange: currentPeriodLabel, previousRange: previousPeriodLabel },
      })
    : currentPeriodLabel;

  return (
    <>
      <AnalyticsStatusStrip />
      <Weather
        kind={weather.kind}
        savingsRatePct={weather.savingsRatePct}
        reason={weather.reason}
      />
      <AnalyticsKpiRow items={kpiItems} periodLabel={currentPeriodLabel} periodShort={periodShort} />
      <TrendCharts points={trendPoints} granularity={granularity} safeUntilDaysNow={safeUntilDays} />
      <CategoryPie
        slices={pieSlices}
        totalLabel={formatRubPrefix(pieTotal)}
        periodLabel={currentPeriodLabel}
      />
      <Compare
        rows={compareRows}
        currentPeriodLabel={currentPeriodLabel}
        previousPeriodLabel={previousPeriodLabel ?? undefined}
        compareMode={compareMode}
        captionLabel={compareCaptionLabel}
        labels={{
          title: t("analytics.compare.title"),
          disabled: t("analytics.compare.disabled"),
          noDataShort: t("analytics.compare.no_data_short"),
          empty: t("analytics.compare.empty"),
          summaryRising: (count) => t("analytics.compare.summary.rising", { vars: { count: String(count) } }),
          summaryFalling: (count) => t("analytics.compare.summary.falling", { vars: { count: String(count) } }),
          colCategory: t("analytics.compare.col.category"),
          colPreviousDefault: t("analytics.compare.col.previous_default"),
          colCurrentDefault: t("analytics.compare.col.current_default"),
          colTrend6m: t("analytics.compare.col.trend_6m"),
        }}
      />
      <Forecast cells={forecastCells} />
      <RunwayByMode data={runwayDashboard} defaultMode={activeMode} />
      <ModesReference modes={STATIC_MODES} activeMode={activeModeLabel} />
    </>
  );
}
