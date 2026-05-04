import { Prisma } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import type {
  PeriodKpis,
  CategoryPieSlice,
  PeriodCompareRow,
  TrendPoint,
  WeatherResult,
  ForecastMonth,
  DateRange,
} from "@/lib/data/analytics";

// ─────────────────────────────────────────────────────────────
// Analytics view types — приближены к mock-форме из mock-analytics.ts
// для механической замены в components/analytics/* (Фаза 9).
// ─────────────────────────────────────────────────────────────

export type AnalyticsKpiView = {
  c: "pos" | "info" | "acc" | "warn";
  k: string;
  v: number;
  vFormat: "money" | "money-pos" | "days";
  delta: string;
  deltaTone: "pos" | "neg" | "mut";
  s: string;
};

export type AnalyticsPieSliceView = {
  name: string;
  sub: string;
  color: string;
  amount: string;
  delta: string;
  deltaTone: "pos" | "neg" | "mut";
  pct: number;
};

export type AnalyticsCmpRowView = {
  name: string;
  sub: string;
  prev: string;
  curr: string;
  delta: string;
  deltaTone: "pos" | "neg" | "mut";
  spark: number[]; // bar heights (px) — для MVP заполняем заглушкой [10,10,10,10,10,10]
};

export type AnalyticsTrendPointView = {
  bucketStart: string;
  inflowBase: number;
  outflowBase: number;
  netBase: number;
};

export type AnalyticsForecastView = {
  k: string;
  v: string;
  vTone: "acc" | "pos" | "info" | "warn" | "neg";
  s: string;
};

export type AnalyticsWeatherView = {
  kind: "sun" | "cloud" | "rain" | "storm";
  savingsRatePct: number | null;
  statusLabel: string;
  // TODO Фаза 9: передавать statusLabel в компонент Weather вместо хардкода
};

export type AnalyticsView = {
  range: { from: string; to: string };
  kpis: AnalyticsKpiView[];
  pie: AnalyticsPieSliceView[];
  compare: AnalyticsCmpRowView[];
  trend: AnalyticsTrendPointView[];
  weather: AnalyticsWeatherView;
  forecast: AnalyticsForecastView[];
};

// ─────────────────────────────────────────────────────────────
// Palette для pie-slices (фиксированный набор, цикличный)
// ─────────────────────────────────────────────────────────────

const PIE_COLORS = [
  "#58D3A3",
  "#F85149",
  "#79C0FF",
  "#D29922",
  "#3FB950",
  "#A371F7",
  "#F0883E",
  "#8B949E",
  "#FF7B72",
  "#56D364",
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fmtBase(s: string): string {
  return formatMoney(new Prisma.Decimal(s), "RUB");
}

function deltaTone(pct: number | null, higherIsBad: boolean): "pos" | "neg" | "mut" {
  if (pct === null || pct === 0) return "mut";
  if (higherIsBad) return pct > 0 ? "neg" : "pos";
  return pct > 0 ? "pos" : "neg";
}

function fmtDelta(pct: number | null): string {
  if (pct === null) return "—";
  if (pct === 0) return "0.0%";
  return pct > 0 ? `▲ ${Math.abs(pct).toFixed(1)}%` : `▼ ${Math.abs(pct).toFixed(1)}%`;
}

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

// TODO Фаза 9: сверить с компонентом kpi-row.tsx — он ожидает {c, k, v, vFormat, delta, deltaTone, s}
export function toKpisView(kpis: PeriodKpis, _safeUntilDays: number | null): AnalyticsKpiView[] {
  const inflow = Number(new Prisma.Decimal(kpis.inflowBase).toFixed(0));
  const outflow = Number(new Prisma.Decimal(kpis.outflowBase).toFixed(0));
  const net = Number(new Prisma.Decimal(kpis.netBase).toFixed(0));
  const sr = kpis.savingsRatePct;

  return [
    {
      c: "pos",
      k: "ДОХОД",
      v: inflow,
      vFormat: "money",
      delta: sr !== null ? `${sr >= 0 ? "▲" : "▼"} ${Math.abs(sr).toFixed(1)}%` : "—",
      deltaTone: sr !== null && sr > 0 ? "pos" : "mut",
      s: "доход за период",
    },
    {
      c: "info",
      k: "РАСХОД",
      v: outflow,
      vFormat: "money",
      delta: "—",
      deltaTone: "mut",
      s: "расход за период",
    },
    {
      c: "acc",
      k: "НЕТТО / МЕС",
      v: net,
      vFormat: net >= 0 ? "money-pos" : "money",
      delta: sr !== null ? `${sr >= 0 ? "+" : ""}${sr.toFixed(1)}% норма` : "—",
      deltaTone: sr !== null ? (sr > 20 ? "pos" : sr > 0 ? "mut" : "neg") : "mut",
      s: sr !== null ? `норма накоплений ${Math.max(0, sr).toFixed(1)}%` : "нет данных",
    },
    {
      c: "warn",
      k: "БЕЗОПАСНО ДО",
      v: _safeUntilDays ?? 0,
      vFormat: "days",
      delta: "—",
      deltaTone: "mut",
      s: "дней при текущем темпе",
    },
  ];
}

// TODO Фаза 9: сверить с компонентом category-pie.tsx — ожидает {name, sub, color, amount, delta, deltaTone, pct}
export function toPieView(
  slices: CategoryPieSlice[],
  compareRows?: PeriodCompareRow[],
): AnalyticsPieSliceView[] {
  const compareMap = new Map(compareRows?.map((r) => [r.categoryId, r]) ?? []);

  return slices.map((s, i) => {
    const cmpRow = compareMap.get(s.categoryId);
    const pct = cmpRow?.deltaPct ?? null;
    return {
      name: s.categoryName,
      sub: s.icon ?? `${s.pct.toFixed(1)}% от расходов`,
      color: PIE_COLORS[i % PIE_COLORS.length],
      amount: fmtBase(s.amountBase),
      delta: fmtDelta(pct),
      deltaTone: deltaTone(pct, true), // рост расходов — bad
      pct: s.pct,
    };
  });
}

// TODO Фаза 9: сверить с компонентом compare.tsx — ожидает {name, sub, prev, curr, delta, deltaTone, spark}
export function toCompareView(rows: PeriodCompareRow[]): AnalyticsCmpRowView[] {
  return rows.map((r) => ({
    name: r.categoryName,
    sub: "",
    prev: fmtBase(r.previousBase),
    curr: fmtBase(r.currentBase),
    delta: fmtDelta(r.deltaPct),
    deltaTone: deltaTone(r.deltaPct, true),
    // spark заглушка для MVP — нет исторических данных по неделям
    spark: [10, 10, 10, 10, 10, 10],
  }));
}

export function toTrendView(points: TrendPoint[]): AnalyticsTrendPointView[] {
  return points.map((p) => ({
    bucketStart: p.bucketStart,
    inflowBase: Number(new Prisma.Decimal(p.inflowBase).toFixed(0)),
    outflowBase: Number(new Prisma.Decimal(p.outflowBase).toFixed(0)),
    netBase: Number(new Prisma.Decimal(p.netBase).toFixed(0)),
  }));
}

// TODO Фаза 9: компонент Weather.tsx отображает статичный текст — передавай weather.kind и label
export function toWeatherView(w: WeatherResult): AnalyticsWeatherView {
  const LABELS: Record<WeatherResult["kind"], string> = {
    sun: "Солнечно",
    cloud: "Облачно",
    rain: "Дождь",
    storm: "Шторм",
  };

  return {
    kind: w.kind,
    savingsRatePct: w.savingsRatePct,
    statusLabel: LABELS[w.kind],
  };
}

// TODO Фаза 9: компонент Forecast.tsx ожидает [{k, v, vTone, s}]
export function toForecastView(f: ForecastMonth): AnalyticsForecastView[] {
  const inflow = Number(new Prisma.Decimal(f.inflowExpectedBase).toFixed(0));
  const outflow = Number(new Prisma.Decimal(f.outflowExpectedBase).toFixed(0));
  const net = Number(new Prisma.Decimal(f.netExpectedBase).toFixed(0));

  return [
    {
      k: "ожидаемый доход",
      v: formatMoney(new Prisma.Decimal(inflow), "RUB"),
      vTone: "pos",
      s: "все транзакции месяца",
    },
    {
      k: "ожидаемый расход",
      v: formatMoney(new Prisma.Decimal(outflow), "RUB"),
      vTone: "info",
      s: "план + факт текущего месяца",
    },
    {
      k: "нетто к концу месяца",
      v: `${net >= 0 ? "+" : ""}${formatMoney(new Prisma.Decimal(net), "RUB")}`,
      vTone: net >= 0 ? "acc" : "neg",
      s: "без учёта незапланированных трат",
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Top-level mapper
// ─────────────────────────────────────────────────────────────

export function toAnalyticsView(args: {
  range: DateRange;
  kpis: PeriodKpis;
  safeUntilDays: number | null;
  pie: CategoryPieSlice[];
  compare: PeriodCompareRow[];
  trend: TrendPoint[];
  weather: WeatherResult;
  forecast: ForecastMonth;
}): AnalyticsView {
  return {
    range: {
      from: args.range.from.toISOString(),
      to: args.range.to.toISOString(),
    },
    kpis: toKpisView(args.kpis, args.safeUntilDays),
    pie: toPieView(args.pie, args.compare),
    compare: toCompareView(args.compare),
    trend: toTrendView(args.trend),
    weather: toWeatherView(args.weather),
    forecast: toForecastView(args.forecast),
  };
}
