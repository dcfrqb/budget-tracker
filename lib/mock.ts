/* Mock data for the demo. Will be replaced by Prisma queries later. */

export const TODAY_ISO = "2026-04-21";
export const MONTH_LABEL = "апр 2026";
export const MONTH_DAY = 21;
export const MONTH_DAYS = 30;


export const STATUS = {
  label: "СТАБИЛЬНО" as const,
  tone: "pos" as const,
};

export type PlanFactCell = {
  code: string;
  kind: "inc" | "exp" | "net";
  fact: number;
  plan: number;
  currency: string;
  sub: string;
  color: "pos" | "info" | "acc";
};

export const PLAN_FACT: PlanFactCell[] = [
  {
    code: "ДОХОД",
    kind: "inc",
    fact: 188400,
    plan: 260000,
    currency: "₽",
    sub: "из ₽ 260 000 · 72%",
    color: "pos",
  },
  {
    code: "РАСХОД",
    kind: "exp",
    fact: 142310,
    plan: 245000,
    currency: "₽",
    sub: "из ₽ 245 000 · 58%",
    color: "info",
  },
  {
    code: "НЕТТО",
    kind: "net",
    fact: 46090,
    plan: 118000,
    currency: "+₽",
    sub: "кон. мес ≈ +₽ 118 000",
    color: "acc",
  },
];

export type Obligation = {
  id: string;
  tag: "LOAN" | "SUB" | "UTIL";
  tagClass: "loan" | "sub" | "util";
  name: string;
  sub: string;
  date: string;
  amount: string;
  meta: string;
};

export const UPCOMING_OBLIGATIONS: Obligation[] = [
  {
    id: "mortgage-sber",
    tag: "LOAN",
    tagClass: "loan",
    name: "Ипотека · Сбер",
    sub: "тело 38 140 + %% 19 260",
    date: "28.04 · 7д",
    amount: "₽ 57 400",
    meta: "авто · фикс",
  },
  {
    id: "subs-bundle",
    tag: "SUB",
    tagClass: "sub",
    name: "Подписки × 6",
    sub: "netflix · spotify · icloud · …",
    date: "02.05 · 11д",
    amount: "₽ 3 890",
    meta: "шеринг · 3 чел",
  },
  {
    id: "utilities-apr",
    tag: "UTIL",
    tagClass: "util",
    name: "ЖКХ · апр",
    sub: "прогноз · ср(3мес) ±8%",
    date: "05.05 · 14д",
    amount: "₽ 14 200",
    meta: "прогноз",
  },
];

export type TopCategory = {
  rank: string;
  name: string;
  sub: string;
  amount: string;
  delta: string;
  deltaDir: "up" | "down"; // up = ▲ (neg color for spending), down = ▼ (pos color)
};

export const TOP_CATEGORIES: TopCategory[] = [
  { rank: "01", name: "Продукты",         sub: "38 транз. · пятёрочка, вкусвилл · ср/нед ₽ 8к", amount: "₽ 32 140", delta: "▲ 18.3%", deltaDir: "up" },
  { rank: "02", name: "Транспорт",        sub: "метро · такси · каршеринг · ср/день ₽ 705",     amount: "₽ 14 820", delta: "▼ 6.1%",  deltaDir: "down" },
  { rank: "03", name: "Кафе и рестораны", sub: "12 визитов · ср/визит ₽ 963 · много выходных",  amount: "₽ 11 560", delta: "▲ 42.0%", deltaDir: "up" },
  { rank: "04", name: "Развлечения",      sub: "кино · концерты · игры · 7 событий",            amount: "₽ 8 940",  delta: "▲ 24.5%", deltaDir: "up" },
  { rank: "05", name: "Здоровье",         sub: "аптека · дантист · ср/мес ₽ 6к",                amount: "₽ 7 280",  delta: "▼ 12.4%", deltaDir: "down" },
  { rank: "06", name: "Одежда",           sub: "4 вещи · zara, uniqlo · ср ₽ 1.6к",             amount: "₽ 6 420",  delta: "▼ 3.8%",  deltaDir: "down" },
];

export type Signal = {
  id: string;
  kind: "acc" | "warn" | "info";
  title: string;
  bodyHtml: string; // pre-rendered innerHTML with <b> for emphasis
};

export const HOME_SIGNALS: Signal[] = [
  {
    id: "tax-hint",
    kind: "acc",
    title: "подсказка · налог",
    bodyHtml: 'Самозанятость 6% с апр. дохода = <b>₽ 11 304</b> · не автоматом · добавь вручную из транзакции',
  },
  {
    id: "drift",
    kind: "warn",
    title: "сигнал · дрейф категории",
    bodyHtml: '<b>Кафе</b> ▲ 42% м/м · в лимите · мягкий cap ₽ 15к на май?',
  },
  {
    id: "50-30-20",
    kind: "info",
    title: "подсказка · 50/30/20",
    bodyHtml: 'последний доход <b>₽ 42 000</b> → нужды 21к · хотелки 12.6к · накопления 8.4к',
  },
];

/* ── SUMMARY RAIL ─────────────────────────────────────────────── */

export const SAFE_UNTIL = {
  days: 47,
  dateIso: "2026-06-07",
  deltaLabel: "+2d vs пред. неделя",
};

export const AVAILABLE = {
  now: 237880,
  total: 312480,
  reserved: 74600,
};

export type Balance = { sym: string; display: string };
export const BALANCES: Balance[] = [
  { sym: "RUB",  display: "284 120 ₽" },
  { sym: "USD",  display: "2 145 $"   },
  { sym: "EUR",  display: "890 €"      },
  { sym: "CASH", display: "18 400 ₽"  },
];

/* 30-day cashflow as small array of normalized points (0..1) */
export const CASHFLOW_30D = [0.30, 0.35, 0.42, 0.41, 0.55, 0.72, 0.80, 0.74, 0.68, 0.71, 0.75, 0.78, 0.85, 0.82];
export const CASHFLOW_DELTA_LABEL = "+14% vs мар";
