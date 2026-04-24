import { AnalyticsKpiRow } from "@/components/analytics/kpi-row";
import { AnalyticsStatusStrip } from "@/components/analytics/status-strip";
import { CategoryPie } from "@/components/analytics/category-pie";
import { Compare } from "@/components/analytics/compare";
import { Forecast } from "@/components/analytics/forecast";
import { ModesReference } from "@/components/analytics/modes-reference";
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
} from "@/lib/data/analytics";
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

export default async function AnalyticsPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));

  const now = new Date();
  const range3m = resolveRange("3m");
  const range1m = resolveRange("1m");

  const currentMonthLabel = `${monthShort[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonthLabel = `${monthShort[prevMonthDate.getUTCMonth()]} ${prevMonthDate.getUTCFullYear()}`;

  const [kpis3m, pie1m, compare1m, forecast, weather, budgetSettings] = await Promise.all([
    getPeriodKpis(userId, range3m, DEFAULT_CURRENCY),
    getCategoryPie(userId, range1m, DEFAULT_CURRENCY),
    getPeriodCompare(userId, range1m, DEFAULT_CURRENCY),
    getForecastMonth(userId, DEFAULT_CURRENCY),
    getWeather(userId, DEFAULT_CURRENCY),
    db.budgetSettings.findUnique({ where: { userId } }),
  ]);

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
      vFormat: net3m.gte(0) ? "money-pos" : "money",
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
      <Weather />
      <AnalyticsKpiRow items={kpiItems} periodLabel={periodFromLabel} />
      <TrendCharts />
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
      <ModesReference modes={STATIC_MODES} activeMode={activeModeLabel} />
    </>
  );
}
