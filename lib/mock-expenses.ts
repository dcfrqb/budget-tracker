export const EXPENSES_KPI = {
  loans:       { label: "КРЕДИТЫ",         value: 57400, sub: "/мес · 1 активен" },
  subs:        { label: "ПОДПИСКИ",        value: 4890,  sub: "/мес · 8 активно" },
  utilities:   { label: "ЖКХ + ДОМ",       value: 16200, sub: "/мес · ср(3мес)" },
  taxes:       { label: "НАЛОГИ · ПОДСК",  value: 11304, sub: "платить вручную" },
  projects:    { label: "ДОЛГИЕ ПРОЕКТЫ",  value: 4,     sub: "заложено ₽ 182к" },
};

export type Subscription = {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  name: string;
  badge: "personal" | "split" | "pays";
  badgeLabel: string;
  period: string;      // "месячно · 30д"
  note: string;        // "шеринг с М., Л. · поровну"
  amount: string;      // "₽ 499"
  share?: string;      // "· ты платишь ₽ 166"
  shareTone?: "muted" | "acc";
  next: string;        // "15 мая · 24d"
  nextTone: "warn" | "ok";
  primaryLabel?: string; // default "Отметить"
};

export const SUBSCRIPTIONS: Subscription[] = [
  { id: "s1", icon: "N", iconColor: "#F85149", iconBg: "rgba(248,81,73,.12)",  name: "Netflix · Стандарт",  badge: "split",    badgeLabel: "Шеринг · 3 чел",       period: "месячно · 30д",  note: "шеринг с М., Л. · поровну",    amount: "₽ 499",   share: "· ты платишь ₽ 166",   shareTone: "muted", next: "15 мая · 24d", nextTone: "warn" },
  { id: "s2", icon: "S", iconColor: "#3FB950", iconBg: "rgba(63,185,80,.12)",  name: "Spotify · Премиум",   badge: "personal", badgeLabel: "Личная",              period: "месячно · 30д",  note: "Тинькофф · авто",              amount: "₽ 299",   next: "02 мая · 11d", nextTone: "warn" },
  { id: "s3", icon: "i", iconColor: "#79C0FF", iconBg: "rgba(121,192,255,.12)", name: "iCloud 2ТБ · семья", badge: "pays",     badgeLabel: "Плачу за всех",       period: "месячно · цикл д-8", note: "5 чел · ты платишь за всех",   amount: "₽ 650",   share: "· вкл. 4 других",      shareTone: "acc",   next: "08 мая · 17d", nextTone: "ok" },
  { id: "s4", icon: "Y", iconColor: "#D29922", iconBg: "rgba(210,153,34,.12)", name: "Яндекс Плюс",         badge: "personal", badgeLabel: "Личная",              period: "годовая · 365д", note: "Сбер · авто · paid фев",       amount: "₽ 2 990", share: "· ~249/мес",           shareTone: "muted", next: "14 фев 2027",  nextTone: "ok",   primaryLabel: "Настроить" },
  { id: "s5", icon: "F", iconColor: "#58D3A3", iconBg: "rgba(88,211,163,.12)", name: "Figma Pro",           badge: "split",    badgeLabel: "Шеринг · 2 чел",       period: "месячно · 30д",  note: "шеринг с партнёром · поровну", amount: "$ 15",    share: "· ты платишь $ 7.50",  shareTone: "muted", next: "18 мая · 27d", nextTone: "warn" },
  { id: "s6", icon: "N", iconColor: "#7D8898", iconBg: "rgba(125,136,152,.15)", name: "NY Times · цифровая", badge: "personal", badgeLabel: "Личная",              period: "месячно · 30д",  note: "Сбер · авто",                  amount: "$ 4",     next: "22 мая · 31d", nextTone: "warn" },
  { id: "s7", icon: "A", iconColor: "#79C0FF", iconBg: "rgba(121,192,255,.12)", name: "Adobe CC · Фото",    badge: "personal", badgeLabel: "Личная",              period: "месячно · 30д",  note: "Тинькофф",                     amount: "$ 10",    next: "05 мая · 14d", nextTone: "warn" },
  { id: "s8", icon: "G", iconColor: "#D29922", iconBg: "rgba(210,153,34,.12)", name: "Зал · партнёр",       badge: "pays",     badgeLabel: "Плачу за всех",       period: "месячно · 30д",  note: "оплачиваешь полностью",        amount: "₽ 2 500", share: "· за партнёра",        shareTone: "acc",   next: "01 мая · 10d", nextTone: "warn" },
];

export type LongProject = {
  id: string;
  name: string;
  sub: string;
  pct: number;
  amountSpent: string;
  amountTotal: string;
  dates: string;
  pctTone?: "warn" | "dim";
};

export const LONG_PROJECTS: LongProject[] = [
  { id: "p1", name: "Ремонт кухни",          sub: "6 транз. · категория: Дом · Ikea, плитка, сантехник",   pct: 64, amountSpent: "₽ 128 000", amountTotal: "₽ 200 000", dates: "янв — июн 2026" },
  { id: "p2", name: "Авто · плановое ТО",     sub: "3 транз. · категория: Авто · масло, шины, тормоза",     pct: 40, amountSpent: "₽ 28 000",  amountTotal: "₽ 70 000",  dates: "мар — авг 2026",    pctTone: "warn" },
  { id: "p3", name: "Курс языка · B2 англ.",  sub: "9 транз. · категория: Образование · репетитор 2р/нед", pct: 82, amountSpent: "₽ 41 000",  amountTotal: "₽ 50 000",  dates: "окт 2025 — май 2026" },
  { id: "p4", name: "Летний трип · Грузия",   sub: "0 транз. · категория: Трип · билеты, отель, еда",       pct: 0,  amountSpent: "₽ 0",       amountTotal: "₽ 150 000", dates: "июл 2026 — авг 2026", pctTone: "dim" },
];

export type ExpenseCategory = {
  id: string;
  name: string;
  sub: string;
  amount: string;
  amountTone?: "info";
  pct: number;
  barColor: string;      // CSS var token
  usageLabel: string;
  total: string;
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "c1", name: "ЖКХ · квартира",              sub: "ЖКХ · электричество · интернет · вода", amount: "₽ 14 200", amountTone: "info", pct: 78, barColor: "var(--warn)", usageLabel: "исп. 78% от мес. бюджета", total: "из ₽ 18 000" },
  { id: "c2", name: "Дом · продукты + бытовое",    sub: "Пятёрочка · ВкусВилл · Лента · бытовое",  amount: "₽ 32 140",                       pct: 89, barColor: "var(--info)", usageLabel: "исп. 89% · пойдёт в перебор", total: "из ₽ 36 000" },
  { id: "c3", name: "Авто · текущее",              sub: "бензин · страховка · парковка",            amount: "₽ 8 900",                        pct: 45, barColor: "var(--accent)", usageLabel: "исп. 45% · стабильно",      total: "из ₽ 20 000" },
  { id: "c4", name: "Интернет + мобильная связь",  sub: "WiFi дома · тарифы (2)",                   amount: "₽ 2 200",                        pct: 92, barColor: "var(--accent)", usageLabel: "исп. 92% · у лимита",         total: "из ₽ 2 400" },
];

export type TaxHint = {
  id: string;
  title: string;
  sub: string;
  dueLabel: string;
  dueTone: "warn" | "muted";
  amount: string;
  amountTone: "warn" | "muted";
  buttonLabel: string;
  buttonKind: "urgent" | "default";
};

export const TAX_HINTS: TaxHint[] = [
  { id: "t1", title: "Самозанятость 6% · апр. фриланс", sub: "с ₽ 188 400 · до 25 мая 2026 · через «Мой налог»", dueLabel: "срок 34д",  dueTone: "warn",   amount: "₽ 11 304", amountTone: "warn",   buttonLabel: "Напомн.", buttonKind: "urgent"  },
  { id: "t2", title: "Налог на имущ. · квартира",       sub: "годовой · до 01 дек 2026 · ФНС считает",           dueLabel: "срок 224д", dueTone: "muted", amount: "₽ 8 400",  amountTone: "muted", buttonLabel: "План",     buttonKind: "default" },
  { id: "t3", title: "Транспортный · VW Polo",          sub: "годовой · до 01 дек 2026",                         dueLabel: "срок 224д", dueTone: "muted", amount: "₽ 3 200",  amountTone: "muted", buttonLabel: "План",     buttonKind: "default" },
];

export const EXPENSES_RESERVED = [
  { k: "Кредиты",       v: "₽ 57 400", tag: "loan" as const, tone: "var(--loan)" },
  { k: "ЖКХ",           v: "₽ 14 200", tag: "util" as const, tone: "var(--util)" },
  { k: "Подписки 30д",  v: "₽ 2 996",  tag: "sub"  as const, tone: "var(--sub)" },
  { k: "Подск. налоги", v: "₽ 0",      tag: "tax"  as const, tone: "var(--tax)" },
];

export const SUBS_MONTHLY = [
  { k: "только ты",            v: "₽ 2 900", tone: "text"  as const },
  { k: "шеринг / твоя доля",   v: "₽ 1 340", tone: "info"  as const },
  { k: "платишь за всех",      v: "₽ 650",   tone: "acc"   as const },
];
