export const ANALYTICS_KPI = [
  { c: "pos",  k: "СРЕДНИЙ ДОХОД",  v: 185700, vFormat: "money", delta: "▲ 8.4%",  deltaTone: "pos" as const, s: "vs пред. 3 мес" },
  { c: "info", k: "СРЕДНИЙ РАСХОД", v: 142100, vFormat: "money", delta: "▲ 4.2%",  deltaTone: "neg" as const, s: "растёт медленнее дохода" },
  { c: "acc",  k: "НЕТТО / МЕС",    v: 43600,  vFormat: "money-pos", delta: "▲ 22%",deltaTone: "pos" as const, s: "норма накоплений 23.5%" },
  { c: "warn", k: "БЕЗОПАСНО ДО",   v: 47,     vFormat: "days", delta: "+2д / нед", deltaTone: "pos" as const, s: "режим «норма»" },
];

export type PieSlice = {
  name: string;
  sub: string;
  color: string;
  amount: string;
  delta: string;
  deltaTone: "pos" | "neg" | "mut";
  pct: number;
};

export const PIE_SLICES: PieSlice[] = [
  { name: "Кредит / ипотека",      sub: "1 обязательство · Сбер",                    color: "#58D3A3", amount: "₽ 57 400", delta: "0.0%",   deltaTone: "mut", pct: 40.3 },
  { name: "Продукты",              sub: "38 транз. · Пятёрочка, ВкусВилл, Лента",    color: "#F85149", amount: "₽ 32 140", delta: "▲ 18.3%", deltaTone: "neg", pct: 22.6 },
  { name: "Транспорт",             sub: "метро · такси · каршеринг",                 color: "#79C0FF", amount: "₽ 14 820", delta: "▼ 6.1%",  deltaTone: "pos", pct: 10.4 },
  { name: "Кафе и рестораны",      sub: "12 визитов · много выходных",                color: "#D29922", amount: "₽ 11 560", delta: "▲ 42.0%", deltaTone: "neg", pct: 8.1 },
  { name: "Развлечения",           sub: "кино · концерты · игры · 7 событий",         color: "#3FB950", amount: "₽ 8 940",  delta: "▲ 24.5%", deltaTone: "neg", pct: 6.3 },
  { name: "Прочее (7 категорий)",  sub: "здоровье · одежда · ЖКХ · подписки · …",     color: "#4E5766", amount: "₽ 17 450", delta: "▼ 3.2%",  deltaTone: "pos", pct: 12.3 },
];

export type CmpRow = {
  name: string;
  sub: string;
  prev: string;
  curr: string;
  delta: string;
  deltaTone: "pos" | "neg" | "mut";
  spark: number[];   // bar heights (px)
};

export const CMP_ROWS: CmpRow[] = [
  { name: "Продукты",           sub: "Пятёрочка, ВкусВилл · ср/нед ₽ 8к",     prev: "₽ 27 170", curr: "₽ 32 140", delta: "▲ 18.3%", deltaTone: "neg", spark: [14, 16, 18, 20, 24, 28] },
  { name: "Транспорт",          sub: "метро · такси · каршеринг",             prev: "₽ 15 790", curr: "₽ 14 820", delta: "▼ 6.1%",  deltaTone: "pos", spark: [22, 24, 20, 22, 20, 18] },
  { name: "Кафе и рестораны",   sub: "12 визитов · выходные-тяжёлые",         prev: "₽ 8 140",  curr: "₽ 11 560", delta: "▲ 42.0%", deltaTone: "neg", spark: [10, 12,  8, 14, 16, 26] },
  { name: "Развлечения",        sub: "кино · концерты · игры · 7 событий",    prev: "₽ 7 180",  curr: "₽ 8 940",  delta: "▲ 24.5%", deltaTone: "neg", spark: [14, 10, 12, 16, 15, 22] },
  { name: "Здоровье",           sub: "аптека · дантист",                      prev: "₽ 8 310",  curr: "₽ 7 280",  delta: "▼ 12.4%", deltaTone: "pos", spark: [18, 20, 16, 14, 18, 16] },
  { name: "Одежда",             sub: "4 вещи · zara, uniqlo",                 prev: "₽ 6 680",  curr: "₽ 6 420",  delta: "▼ 3.8%",  deltaTone: "pos", spark: [10,  8, 14, 16, 12, 11] },
  { name: "ЖКХ",                sub: "электричество · интернет · вода",        prev: "₽ 14 100", curr: "₽ 14 200", delta: "▲ 0.7%",  deltaTone: "mut", spark: [22, 23, 22, 21, 22, 23] },
  { name: "Подписки",           sub: "8 активно · Netflix · Spotify · …",      prev: "₽ 4 890",  curr: "₽ 4 890",  delta: "0.0%",    deltaTone: "mut", spark: [10, 10, 10, 10, 10, 10] },
];

export const FORECAST = [
  { k: "конец месяца (апр)",  v: "+₽ 118 000",   vTone: "acc"  as const, s: "доход 260 · расход 147 · нетто +113, + текущий запас" },
  { k: "конец квартала (Q2)", v: "+₽ 385 000",   vTone: "pos"  as const, s: "при неизменном доходе и лимитах «норма»" },
  { k: "конец года (YE26)",   v: "+₽ 1 150 000", vTone: "info" as const, s: "+отпускные · квартальные премии · без неожиданностей" },
];

export type ModeCard = {
  id: "lean" | "norm" | "free";
  name: string;
  tag: string;
  active: boolean;
  safeDays: string;
  safeColor: string;
  limits: { k: string; v: string }[];
};

export const MODES: ModeCard[] = [
  {
    id: "lean", name: "Эконом", tag: "жёсткие лимиты · альтернативный сигнал", active: false,
    safeDays: "63 дн", safeColor: "var(--accent)",
    limits: [
      { k: "Продукты",     v: "₽ 24 000 / мес" },
      { k: "Кафе",         v: "₽ 4 000 / мес" },
      { k: "Развлечения",  v: "₽ 3 000 / мес" },
      { k: "Одежда",       v: "₽ 2 000 / мес" },
    ],
  },
  {
    id: "norm", name: "Норма", tag: "дефолт · всё в порядке", active: true,
    safeDays: "47 дн", safeColor: "var(--pos)",
    limits: [
      { k: "Продукты",     v: "₽ 36 000 / мес" },
      { k: "Кафе",         v: "₽ 12 000 / мес" },
      { k: "Развлечения",  v: "₽ 10 000 / мес" },
      { k: "Одежда",       v: "₽ 8 000 / мес" },
    ],
  },
  {
    id: "free", name: "Свобода", tag: "ты на свободе · лимиты мягкие", active: false,
    safeDays: "34 дн", safeColor: "var(--info)",
    limits: [
      { k: "Продукты",     v: "₽ 45 000 / мес" },
      { k: "Кафе",         v: "₽ 18 000 / мес" },
      { k: "Развлечения",  v: "₽ 15 000 / мес" },
      { k: "Одежда",       v: "₽ 14 000 / мес" },
    ],
  },
];

export const WX_FACTORS = [
  { k: "безоп. остаток",   v: "✓ 47д",          tone: "pos"  as const },
  { k: "резерв",           v: "✓ 24%",          tone: "pos"  as const },
  { k: "волатильность",    v: "~ 24%",          tone: "warn" as const },
  { k: "дрейф категорий",  v: "~ кафе ▲42%",    tone: "warn" as const },
  { k: "накопления",       v: "✓ 23.5%",        tone: "pos"  as const },
];

export const TOP_DELTAS = [
  { k: "кафе",         v: "▲ 42.0%", tone: "neg" as const },
  { k: "развлечения",  v: "▲ 24.5%", tone: "neg" as const },
  { k: "продукты",     v: "▲ 18.3%", tone: "neg" as const },
  { k: "здоровье",     v: "▼ 12.4%", tone: "pos" as const },
  { k: "транспорт",    v: "▼ 6.1%",  tone: "pos" as const },
];
