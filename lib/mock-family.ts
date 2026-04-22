export const GROUP = {
  name: "Никитины · семья",
  sub: "квартира · общие подписки · общие накопления",
  createdAt: "02 фев 2024",
  members: [
    { letter: "W", color: "var(--accent)" },
    { letter: "M", color: "var(--info)" },
    { letter: "S", color: "var(--warn)" },
  ],
  stats: [
    { k: "общее за апрель",   v: 86400, tone: "text" as const, s: "35 транзакций · 12 категорий" },
    { k: "моя доля",          v: 42800, tone: "acc"  as const, s: "49.5% от общего" },
    { k: "текущий баланс",    v: 3280,  tone: "pos"  as const, s: "тебе должны по расчёту", prefix: "+₽" },
  ],
};

export const INVITE = {
  title: "Ссылка-приглашение · открыта на 7 дней",
  sub: "одноразовая · при переходе нужен номер телефона · можно отозвать",
  link: "bdg.tracker/g/nikitiny/abc7x9",
};

export const SPACES = [
  { id: "shared",   tag: "активно · общее",  n: "Семья · общее пространство", s: "видят все 3 участника",        amount: "₽ 86 400",  amountLabel: "за апрель · все",  active: true  },
  { id: "personal", tag: "только ты",         n: "Моё личное",                  s: "видишь только ты · скрыто от остальных", amount: "₽ 55 910",  amountLabel: "за апрель · лично", active: false },
  { id: "all",      tag: "представление",     n: "Всё вместе",                  s: "объединённое отображение у тебя",          amount: "₽ 142 310", amountLabel: "за апрель · всё",   active: false },
];

export type Member = {
  id: string;
  letter: string;
  color: string;
  name: string;
  role: "owner" | "mem";
  roleLabel: string;
  since: string;
  stats: { k: string; v: string; tone?: "pos" }[];
  balK: string;
  balV: string;
  balTone: "pos" | "warn";
};

export const MEMBERS: Member[] = [
  {
    id: "w", letter: "W", color: "var(--accent)",
    name: "Ты (Владимир)", role: "owner", roleLabel: "Владелец", since: "dcfrqb@gmail.com",
    stats: [
      { k: "Внёс за мес",  v: "₽ 42 800", tone: "pos" },
      { k: "Доля",          v: "49.5%" },
      { k: "Транзакций",    v: "18" },
      { k: "Подписки",      v: "3 split · 1 за всех" },
    ],
    balK: "итого по сверке", balV: "+₽ 3 280 тебе должны", balTone: "pos",
  },
  {
    id: "m", letter: "M", color: "var(--info)",
    name: "Маша", role: "mem", roleLabel: "Участник", since: "присоединилась 05.02.2024",
    stats: [
      { k: "Внесла за мес", v: "₽ 38 720" },
      { k: "Доля",           v: "44.8%" },
      { k: "Транзакций",     v: "14" },
      { k: "Подписки",       v: "3 split" },
    ],
    balK: "итого по сверке", balV: "−₽ 1 840 должна", balTone: "warn",
  },
  {
    id: "s", letter: "S", color: "var(--warn)",
    name: "Сестра Лена", role: "mem", roleLabel: "Участник", since: "присоединилась 18.03.2026",
    stats: [
      { k: "Внесла за мес", v: "₽ 4 880" },
      { k: "Доля",           v: "5.6%" },
      { k: "Транзакций",     v: "3" },
      { k: "Подписки",       v: "0" },
    ],
    balK: "итого по сверке", balV: "−₽ 1 440 должна", balTone: "warn",
  },
];

export const BALANCE_FLOWS = [
  { from: { letter: "M", color: "var(--info)" }, fromName: "Маша",       to: { letter: "W", color: "var(--accent)" }, toName: "Тебе", label: "должна", amount: "₽ 1 840", muted: false },
  { from: { letter: "S", color: "var(--warn)" }, fromName: "Лена",       to: { letter: "W", color: "var(--accent)" }, toName: "Тебе", label: "должна", amount: "₽ 1 440", muted: false },
  { from: { letter: "S", color: "var(--warn)" }, fromName: "Лена ↔ Маша", to: null, toName: "расчёт пустой",                           label: "взаимозачёт", amount: "₽ 0", muted: true },
];

export type SharedTxn = {
  id: string;
  kind: "exp" | "inc";
  date: string;      // "20.04"
  weekday: string;   // "вс"
  name: string;
  sub: string;
  paid: string;
  split: string;     // "W / M / S"
  splitPer: string;  // "по ₽ 990"
  cat: string;
  amount: string;
};

export const SHARED_TXNS: SharedTxn[] = [
  { id: "sh1", kind: "exp", date: "20.04", weekday: "вс", name: "Пятёрочка · продукты на неделю",  sub: "VkusVill + Пятёрочка · 2 магазина",      paid: "платил · W",  split: "W / M / S",    splitPer: "по ₽ 990",  cat: "Продукты",  amount: "−₽ 2 970" },
  { id: "sh2", kind: "inc", date: "18.04", weekday: "пт", name: "Ипотека · общий взнос Маши",       sub: "доля Маши за месяц",                     paid: "перев. · M → W", split: "W 60 / M 40",   splitPer: "по договор.", cat: "Ипотека",   amount: "+₽ 22 960" },
  { id: "sh3", kind: "exp", date: "15.04", weekday: "вт", name: "ЖКХ · апрель",                     sub: "электричество · вода · интернет",        paid: "платил · W",  split: "W / M",         splitPer: "по ₽ 7 100", cat: "ЖКХ",       amount: "−₽ 14 200" },
  { id: "sh4", kind: "exp", date: "12.04", weekday: "сб", name: "Ресторан · ужин на 5 человек",      sub: "Coffeemania · с друзьями",               paid: "платила · M", split: "W / M",         splitPer: "по ₽ 3 700", cat: "Кафе",      amount: "−₽ 7 400" },
  { id: "sh5", kind: "exp", date: "08.04", weekday: "ср", name: "Такси · семья в аэропорт",         sub: "встречали Лену · Яндекс такси",          paid: "платил · W",  split: "W / M / S",    splitPer: "по ₽ 940",  cat: "Транспорт", amount: "−₽ 2 820" },
  { id: "sh6", kind: "exp", date: "04.04", weekday: "сб", name: "Лента · большие закупки",          sub: "бытовое + продукты на месяц",            paid: "платила · M", split: "W / M",         splitPer: "по ₽ 4 200", cat: "Продукты",  amount: "−₽ 8 400" },
  { id: "sh7", kind: "exp", date: "02.04", weekday: "чт", name: "ИКЕА · стеллаж в прихожую",        sub: "проект «обустройство» · чек за ремонт",  paid: "платил · W",  split: "W / M",         splitPer: "по ₽ 11 250",cat: "Дом",        amount: "−₽ 22 500" },
];

export type SharedFund = {
  id: string;
  kindLabel: string;
  due: string;
  name: string;
  sub: string;
  contrib: { who: string; avLetter?: string; avColor?: string; amount: string; tone?: "acc" }[];
  pct: number;
  footV: string;
};

export const SHARED_FUNDS: SharedFund[] = [
  {
    id: "sf1", kindLabel: "Трип", due: "срок 05.07 · 75д",
    name: "Грузия · летний трип", sub: "2 чел (W + M) · 10 дней · равный сплит",
    contrib: [
      { who: "Ты",          avLetter: "W", avColor: "var(--accent)", amount: "₽ 31 000" },
      { who: "Маша",        avLetter: "M", avColor: "var(--info)",    amount: "₽ 31 000" },
      { who: "фонд всего",  amount: "₽ 62 000", tone: "acc" },
    ],
    pct: 41, footV: "41% · осталось ₽ 88 000",
  },
  {
    id: "sf2", kindLabel: "Дом", due: "бессрочно · проект",
    name: "Ремонт кухни", sub: "2 чел · W 60% / M 40% по договор.",
    contrib: [
      { who: "Ты",          avLetter: "W", avColor: "var(--accent)", amount: "₽ 76 800" },
      { who: "Маша",        avLetter: "M", avColor: "var(--info)",    amount: "₽ 51 200" },
      { who: "фонд всего",  amount: "₽ 128 000", tone: "acc" },
    ],
    pct: 64, footV: "64% · осталось ₽ 72 000",
  },
];

export type SharedSub = {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  name: string;
  sub: string;
  badge: "split" | "pays";
  badgeLabel: string;
  segments: { color: string; pct: number }[];   // share bar segments
  members: { letter: string; color: string; small?: boolean }[];
  amount: string;
  your: string;
  yourTone?: "acc";
};

export const SHARED_SUBS: SharedSub[] = [
  {
    id: "ss1", icon: "N", iconColor: "#F85149", iconBg: "rgba(248,81,73,.12)",
    name: "Netflix · Стандарт", sub: "месячно · 15 мая · платит Маша",
    badge: "split", badgeLabel: "Шеринг · 3 чел",
    segments: [
      { color: "var(--accent)", pct: 33.3 },
      { color: "var(--info)",   pct: 33.3 },
      { color: "var(--warn)",   pct: 33.3 },
    ],
    members: [
      { letter: "W", color: "var(--accent)" },
      { letter: "M", color: "var(--info)" },
      { letter: "S", color: "var(--warn)" },
    ],
    amount: "₽ 499", your: "ты · ₽ 166",
  },
  {
    id: "ss2", icon: "i", iconColor: "#79C0FF", iconBg: "rgba(121,192,255,.12)",
    name: "iCloud 2ТБ · семейный", sub: "месячно · 8 мая · платишь ты",
    badge: "pays", badgeLabel: "Платишь за всех · 5",
    segments: [{ color: "var(--accent)", pct: 100 }],
    members: [
      { letter: "W", color: "var(--accent)" },
      { letter: "M", color: "var(--info)" },
      { letter: "S", color: "var(--warn)" },
      { letter: "+2", color: "var(--muted)", small: true },
    ],
    amount: "₽ 650", your: "ты · ₽ 650", yourTone: "acc",
  },
  {
    id: "ss3", icon: "F", iconColor: "#58D3A3", iconBg: "rgba(88,211,163,.12)",
    name: "Figma Pro", sub: "месячно · 18 мая · платишь ты",
    badge: "split", badgeLabel: "Шеринг · 2 чел",
    segments: [
      { color: "var(--accent)", pct: 50 },
      { color: "var(--info)",   pct: 50 },
    ],
    members: [
      { letter: "W", color: "var(--accent)" },
      { letter: "M", color: "var(--info)" },
    ],
    amount: "$ 15", your: "ты · $ 7.50",
  },
  {
    id: "ss4", icon: "З", iconColor: "#D29922", iconBg: "rgba(210,153,34,.12)",
    name: "Зал · партнёр", sub: "месячно · 1 мая · платишь ты полностью",
    badge: "pays", badgeLabel: "Платишь за · M",
    segments: [{ color: "var(--accent)", pct: 100 }],
    members: [{ letter: "M", color: "var(--info)" }],
    amount: "₽ 2 500", your: "ты · ₽ 2 500", yourTone: "acc",
  },
];

export const MINI_BALS = [
  { av: { letter: "M", color: "var(--info)" }, k: "Маша → тебе", v: "+₽ 1 840" },
  { av: { letter: "S", color: "var(--warn)" }, k: "Лена → тебе", v: "+₽ 1 440" },
  { av: null,                                     k: "итого",        v: "+₽ 3 280" },
];

export const SHARED_TOTALS = [
  { k: "Продукты",           v: "₽ 34 270" },
  { k: "ЖКХ",                v: "₽ 14 200" },
  { k: "Дом / ремонт",       v: "₽ 22 500" },
  { k: "Кафе",               v: "₽ 7 400" },
  { k: "Транспорт",          v: "₽ 2 820" },
  { k: "Подписки (шеринг)",  v: "₽ 5 210" },
];
