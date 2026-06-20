import { AnalyticsKpiRow } from "@/components/analytics/kpi-row";
import { Suspense } from "react";
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
import { Prescriptive } from "@/components/analytics/prescriptive";
import { RunwayByMode } from "@/components/analytics/runway-by-mode";
import { TrendCharts } from "@/components/analytics/trend";
import { Weather } from "@/components/analytics/weather";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import {
  resolveRange,
  getPeriodKpis,
  getCategoryPie,
  getPeriodCompare,
  getForecastMonth,
  getForecastYear,
  getWeather,
  getTrendPoints,
  getCompareSparklines,
} from "@/lib/data/analytics";
import { getRunwayByMode } from "@/lib/data/analytics-runway";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { getAvailableNow } from "@/lib/data/_shared/period-aggregates";
import { getBurnRate, getShrinkableCategories, getObligatoryDiscretionarySplit, getEconomyExitScenario } from "@/lib/data/analytics-prescriptive";
import { getLocale, getT } from "@/lib/i18n/server";
import { pluralRu, pluralEn } from "@/lib/i18n/plural";
import { ruPluralForms } from "@/lib/i18n/locales/ru";
import { enPluralForms } from "@/lib/i18n/locales/en";
import { getBudgetSettings } from "@/lib/data/settings";
import { Prisma } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import type { AnalyticsKpiItem } from "@/components/analytics/kpi-row";
import type { PieSliceView, CategoryPieLabels } from "@/components/analytics/category-pie";
import type { CompareRow } from "@/components/analytics/compare";
import type { ForecastCell } from "@/components/analytics/forecast";
import type { ModeCard } from "@/components/analytics/modes-reference";
import type { PrescriptiveLabels } from "@/components/analytics/prescriptive";

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
  const [userId, t, locale, tz] = await Promise.all([getCurrentUserId(), getT(), getLocale(), getCurrentUserTz()]);

  const sp = searchParams ? await searchParams : {};
  const trendPeriod = parseAnalyticsPeriod(sp.p);
  const compareMode = parseAnalyticsCompare(sp.cmp);

  const currentRange = resolveRange(trendPeriod);
  const granularity = trendGranularity(trendPeriod);

  const compareRange = resolveCompareRange(currentRange, compareMode);

  const currentPeriodLabel = formatPeriodLabel(currentRange, t);
  const previousPeriodLabel = compareRange ? formatPeriodLabel(compareRange, t) : null;

  const now = new Date();

  const [kpis, pie, compare, forecast, forecastYear, weather, budgetSettings, runwayDashboard, trendPoints, homeDash, compareSparklines, availableNow, burnRate, shrinkable, splitData, economyExit] = await Promise.all([
    getPeriodKpis(userId, currentRange, DEFAULT_CURRENCY),
    getCategoryPie(userId, currentRange, DEFAULT_CURRENCY),
    getPeriodCompare(userId, currentRange, DEFAULT_CURRENCY, compareRange),
    getForecastMonth(userId, DEFAULT_CURRENCY),
    getForecastYear(userId, DEFAULT_CURRENCY, tz),
    getWeather(userId, DEFAULT_CURRENCY, tz, currentRange),
    getBudgetSettings(userId),
    getRunwayByMode(userId, DEFAULT_CURRENCY, tz),
    getTrendPoints(userId, currentRange, DEFAULT_CURRENCY, granularity, tz),
    getHomeDashboard(userId, DEFAULT_CURRENCY),
    getCompareSparklines(userId, DEFAULT_CURRENCY, tz, 6, now.getTime()),
    getAvailableNow(userId, DEFAULT_CURRENCY, now),
    getBurnRate(userId, DEFAULT_CURRENCY, tz, now),
    getShrinkableCategories(userId, DEFAULT_CURRENCY, tz, now),
    getObligatoryDiscretionarySplit(userId, currentRange, DEFAULT_CURRENCY, tz),
    getEconomyExitScenario(userId, DEFAULT_CURRENCY, tz, now),
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
        ? t("analytics.kpi.savings_rate", { vars: { pct: String(Math.round(kpis.savingsRatePct)) } })
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
    {
      k: t("analytics.kpi.avg_spend_day"),
      v: (() => {
        const periodDays = Math.max(1, Math.round((currentRange.to.getTime() - currentRange.from.getTime()) / (24 * 60 * 60 * 1000)));
        return Number(outflow.div(periodDays).toFixed(0));
      })(),
      vFormat: "money",
      delta: "",
      deltaTone: "info",
      s: t("analytics.kpi.avg_spend_day_sub"),
      c: "info",
    },
  ];

  // ── Pie slices ───────────────────────────────────────────────
  const pieTotal = pie.reduce((s, sl) => s.plus(sl.amountBase), new Prisma.Decimal(0));

  const pieSlices: PieSliceView[] = pie.slice(0, 8).map((sl, i) => ({
    name: sl.categoryName,
    sub: sl.icon ?? "",
    amount: formatMoney(new Prisma.Decimal(sl.amountBase), "RUB"),
    pct: sl.pct,
    color: BAR_COLORS[i % BAR_COLORS.length],
    delta: "",
    deltaTone: "muted",
  }));

  const pieCategoryWord = locale === "ru"
    ? pluralRu(pieSlices.length, ruPluralForms.categories)
    : pluralEn(pieSlices.length, ...enPluralForms.categories);
  const categoryPieLabels: CategoryPieLabels = {
    title: t("analytics.category_pie.title"),
    periodDefault: t("analytics.category_pie.period_default"),
    meta: t("analytics.category_pie.meta", { vars: { count: String(pieSlices.length), word: pieCategoryWord } }),
    totalLabel: t("analytics.category_pie.total_label"),
    legendPeriod: t("analytics.category_pie.legend_period"),
    legendPeriodDefault: t("analytics.category_pie.legend_period_default"),
    empty: t("analytics.category_pie.empty"),
  };

  // ── Compare rows ─────────────────────────────────────────────
  const compareRows: CompareRow[] = compareMode === "none" ? [] : compare
    .sort((a, b) => new Prisma.Decimal(b.currentBase).comparedTo(new Prisma.Decimal(a.currentBase)))
    .slice(0, 10)
    .map((r) => {
      const deltaPct = r.deltaPct;
      const deltaStr = r.kind !== "delta"
        ? ""
        : deltaPct === null
          ? "—"
          : deltaPct > 0
            ? `▲ ${Math.abs(deltaPct).toFixed(1)}%`
            : `▼ ${Math.abs(deltaPct).toFixed(1)}%`;
      const deltaTone = r.kind !== "delta" ? "muted" : (deltaPct === null ? "muted" : deltaPct > 0 ? "neg" : "pos");
      return {
        name: r.categoryName,
        sub: "",
        prev: formatMoney(new Prisma.Decimal(r.previousBase), "RUB"),
        curr: formatMoney(new Prisma.Decimal(r.currentBase), "RUB"),
        delta: deltaStr,
        deltaTone,
        kind: r.kind,
        spark: compareSparklines.get(r.categoryId) ?? [],
      };
    });

  // ── Forecast cells ───────────────────────────────────────────
  const fcInflow = new Prisma.Decimal(forecast.inflowExpectedBase);
  const fcOutflow = new Prisma.Decimal(forecast.outflowExpectedBase);
  const fcNet = new Prisma.Decimal(forecast.netExpectedBase);

  const forecastCells: ForecastCell[] = [
    {
      k: t("analytics.forecast.income"),
      v: formatMoney(fcInflow, "RUB"),
      s: t("analytics.forecast.sub_plan"),
      vTone: "pos",
    },
    {
      k: t("analytics.forecast.expense"),
      v: formatMoney(fcOutflow, "RUB"),
      s: t("analytics.forecast.sub_plan"),
      vTone: "",
    },
    {
      k: t("analytics.forecast.net"),
      v: formatMoney(fcNet, "RUB"),
      s: fcNet.gte(0) ? t("analytics.forecast.net_pos") : t("analytics.forecast.net_neg"),
      vTone: fcNet.gte(0) ? "pos" : "neg",
    },
  ];

  // ── Forecast secondary cells (posture + year) ────────────────
  const reservedDec = availableNow.reservedBase;
  const freeDec = availableNow.freeBase;
  const liquidDec = availableNow.liquidBase;

  const forecastSecondaryCells: ForecastCell[] = [
    {
      k: t("analytics.forecast.reserved"),
      v: formatMoney(reservedDec, "RUB"),
      s: t("analytics.forecast.posture_sub"),
      vTone: "muted",
    },
    {
      k: t("analytics.forecast.free"),
      v: formatMoney(freeDec, "RUB"),
      s: t("analytics.forecast.posture_sub"),
      vTone: freeDec.gt(0) ? "pos" : "neg",
    },
    {
      k: t("analytics.forecast.liquid"),
      v: formatMoney(liquidDec, "RUB"),
      s: t("analytics.forecast.posture_sub"),
      vTone: "info",
    },
  ];

  const yearNetDec = new Prisma.Decimal(forecastYear.netProjectedBase);
  const yearNetCell: ForecastCell = {
    k: t("analytics.forecast.year_net"),
    v: formatMoney(yearNetDec, "RUB"),
    s: forecastYear.monthsOfHistory < 2
      ? t("analytics.forecast.year_low_confidence")
      : t("analytics.forecast.year_sub"),
    vTone: yearNetDec.gte(0) ? "pos" : "neg",
  };

  // ── Prescriptive data ────────────────────────────────────────
  const burnPerDay30 = new Prisma.Decimal(burnRate.perDay30dBase);
  const burnPerDay90 = new Prisma.Decimal(burnRate.perDay90dBase);

  const daysToZeroDisplay =
    burnRate.daysToZero === null ? "—" : String(burnRate.daysToZero);

  let daysToZeroTone = "muted";
  if (burnRate.daysToZero !== null) {
    if (burnRate.daysToZero > 30) daysToZeroTone = "pos";
    else if (burnRate.daysToZero >= 7) daysToZeroTone = "warn";
    else daysToZeroTone = "neg";
  }

  const prescriptiveLabels: PrescriptiveLabels = {
    title: t("analytics.prescriptive.title"),
    subtitle: t("analytics.prescriptive.subtitle"),
    meta: t("analytics.prescriptive.meta"),
    burn: {
      title: t("analytics.prescriptive.burn.title"),
      per_day_30: t("analytics.prescriptive.burn.per_day_30"),
      per_day_90: t("analytics.prescriptive.burn.per_day_90"),
      days_to_zero: t("analytics.prescriptive.burn.days_to_zero"),
      days_to_zero_sub: t("analytics.prescriptive.burn.days_to_zero_sub"),
      already_negative: t("analytics.prescriptive.burn.already_negative"),
      no_burn: t("analytics.prescriptive.burn.no_burn"),
    },
    shrink: {
      title: t("analytics.prescriptive.shrink.title"),
      subtitle: t("analytics.prescriptive.shrink.subtitle"),
      col_current: t("analytics.prescriptive.shrink.col_current"),
      col_avg: t("analytics.prescriptive.shrink.col_avg"),
      col_over: t("analytics.prescriptive.shrink.col_over"),
      empty: t("analytics.prescriptive.shrink.empty"),
    },
    split: {
      title: t("analytics.prescriptive.split.title"),
      subtitle: t("analytics.prescriptive.split.subtitle"),
      obligatory: t("analytics.prescriptive.split.obligatory"),
      discretionary: t("analytics.prescriptive.split.discretionary"),
      cuttable_pct: t("analytics.prescriptive.split.cuttable_pct"),
      empty: t("analytics.prescriptive.split.empty"),
    },
    economy_exit: {
      title: t("analytics.prescriptive.economy_exit.title"),
      subtitle: t("analytics.prescriptive.economy_exit.subtitle"),
      months: t("analytics.prescriptive.economy_exit.months"),
      no_deficit: t("analytics.prescriptive.economy_exit.no_deficit"),
      no_surplus: t("analytics.prescriptive.economy_exit.no_surplus"),
      deficit_label: t("analytics.prescriptive.economy_exit.deficit_label"),
      recovery_label: t("analytics.prescriptive.economy_exit.recovery_label"),
    },
  };

  const economyExitFormatted = {
    deficit: formatMoney(new Prisma.Decimal(economyExit.deficitBase), DEFAULT_CURRENCY),
    monthlyRecovery: formatMoney(new Prisma.Decimal(economyExit.monthlyRecoveryBase), DEFAULT_CURRENCY),
  };

  const splitFormatted = {
    obligatory: formatMoney(new Prisma.Decimal(splitData.obligatoryBase), "RUB"),
    discretionary: formatMoney(new Prisma.Decimal(splitData.discretionaryBase), "RUB"),
    total: splitData.totalBase,
    discretionaryPct: splitData.discretionaryPct,
  };

  const shrinkFormatted = shrinkable.map((cat) => ({
    name: cat.categoryName,
    icon: cat.icon,
    current: formatMoney(new Prisma.Decimal(cat.currentMonthBase), "RUB"),
    avg: formatMoney(new Prisma.Decimal(cat.avg6mBase), "RUB"),
    over: formatMoney(new Prisma.Decimal(cat.overspendBase), "RUB"),
    overPct: String(Math.round(cat.overspendPct * 10) / 10),
  }));

  // ── Modes ────────────────────────────────────────────────────
  const activeMode = budgetSettings?.activeMode ?? "NORMAL";
  const activeModeLabel = t(`analytics.mode.${activeMode}` as Parameters<typeof t>[0]);

  const formatModeDays = (days: number | null): string =>
    days === null ? "—" : String(days);

  const formatModeLimit = (limitBase: string): string => {
    const dec = new Prisma.Decimal(limitBase);
    return dec.isZero() ? "—" : formatMoney(dec, DEFAULT_CURRENCY);
  };

  const STATIC_MODES: ModeCard[] = [
    {
      id: "lean",
      name: t("analytics.mode.ECONOMY"),
      tag: t("analytics.mode.economy_tag"),
      active: activeMode === "ECONOMY",
      limits: [
        {
          k: t("analytics.mode.limit_key"),
          v: formatModeLimit(runwayDashboard.byMode.ECONOMY.monthlyLimitBase),
        },
      ],
      safeDays: formatModeDays(runwayDashboard.byMode.ECONOMY.days),
      safeColor: "var(--accent)",
    },
    {
      id: "norm",
      name: t("analytics.mode.NORMAL"),
      tag: t("analytics.mode.normal_tag"),
      active: activeMode === "NORMAL",
      limits: [
        {
          k: t("analytics.mode.limit_key"),
          v: formatModeLimit(runwayDashboard.byMode.NORMAL.monthlyLimitBase),
        },
      ],
      safeDays: formatModeDays(runwayDashboard.byMode.NORMAL.days),
      safeColor: "var(--pos)",
    },
    {
      id: "free",
      name: t("analytics.mode.FREE"),
      tag: t("analytics.mode.free_tag"),
      active: activeMode === "FREE",
      limits: [
        {
          k: t("analytics.mode.limit_key"),
          v: formatModeLimit(runwayDashboard.byMode.FREE.monthlyLimitBase),
        },
      ],
      safeDays: formatModeDays(runwayDashboard.byMode.FREE.days),
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
      <Suspense fallback={null}>
        <AnalyticsStatusStrip />
      </Suspense>
      <Weather
        kind={weather.kind}
        savingsRatePct={weather.savingsRatePct}
        reason={weather.reason}
      />
      <AnalyticsKpiRow items={kpiItems} periodLabel={currentPeriodLabel} periodShort={periodShort} />
      <TrendCharts points={trendPoints} granularity={granularity} safeUntilDaysNow={safeUntilDays} />
      <CategoryPie
        slices={pieSlices}
        totalLabel={formatMoney(pieTotal, "RUB")}
        periodLabel={currentPeriodLabel}
        labels={categoryPieLabels}
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
          summaryRising: (count) => t("analytics.compare.summary.rising", {
            vars: {
              count: String(count),
              word: locale === "ru"
                ? pluralRu(count, ruPluralForms.categories)
                : pluralEn(count, ...enPluralForms.categories),
            },
          }),
          summaryFalling: (count) => t("analytics.compare.summary.falling", {
            vars: {
              count: String(count),
              word: locale === "ru"
                ? pluralRu(count, ruPluralForms.categories)
                : pluralEn(count, ...enPluralForms.categories),
            },
          }),
          colCategory: t("analytics.compare.col.category"),
          colPreviousDefault: t("analytics.compare.col.previous_default"),
          colCurrentDefault: t("analytics.compare.col.current_default"),
          colTrend6m: t("analytics.compare.col.trend_6m"),
          deltaNew: t("analytics.compare.delta_new"),
          deltaGone: t("analytics.compare.delta_gone"),
        }}
      />
      <Forecast
        cells={forecastCells}
        secondaryCells={[...forecastSecondaryCells, yearNetCell]}
        labels={{
          title: t("analytics.forecast.title"),
          subtitle: t("analytics.forecast.subtitle"),
          meta: t("analytics.forecast.meta"),
          empty: t("analytics.forecast.empty"),
        }}
      />
      <RunwayByMode data={runwayDashboard} defaultMode={activeMode} />
      <Prescriptive
        burn={burnRate}
        shrinkable={shrinkable}
        labels={prescriptiveLabels}
        burnFormatted={{
          perDay30: formatMoney(burnPerDay30, "RUB"),
          perDay90: formatMoney(burnPerDay90, "RUB"),
          daysToZero: daysToZeroDisplay,
          daysToZeroTone,
        }}
        shrinkFormatted={shrinkFormatted}
        splitFormatted={splitFormatted}
        economyExit={economyExit}
        economyExitFormatted={economyExitFormatted}
      />
      <ModesReference
        modes={STATIC_MODES}
        activeMode={activeModeLabel}
        labels={{
          title: t("analytics.mode.reference.title"),
          subtitle: t("analytics.mode.reference.subtitle"),
          active_on: t("analytics.mode.reference.active_on", { vars: { name: activeModeLabel } }),
          active_off: t("analytics.mode.reference.active_off"),
          pill_on: t("analytics.mode.reference.pill_on"),
          pill_off: t("analytics.mode.reference.pill_off"),
          safe_until_label: t("analytics.mode.reference.safe_until_label"),
          empty: t("analytics.mode.reference.empty"),
        }}
      />
    </>
  );
}
