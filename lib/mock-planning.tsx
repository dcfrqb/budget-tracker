export const PLANNING_KPI = {
  saved:  { label: "НАКОПЛЕНО",    value: 284500, sub: "из ₽ 742 000 цели · 38%" },
  monthly:{ label: "ВЗНОС / МЕС",  value: 42000,  sub: "6 активных фондов" },
  next:   { label: "БЛИЖ. СОБЫТИЕ", label2: "12д", sub: "03 мая · ДР папы" },
  hours:  { label: "ЧАСЫ ДО ЦЕЛИ", value: 388,   sub: "все фонды · при ₽ 1180/ч" },
};

export type EvtKind = "bday" | "holiday" | "trip" | "buy" | "other";

export type CalendarEvent = {
  id: string;
  kind: EvtKind;
  letter: string;
  date: string;
  weekday: string;
  inDays: string;
  name: string;
  sub: string;
  fundLabel?: string;
  amount: string;
  amountTone?: "warn" | "pos" | "acc";
};

export type CalendarMonth = {
  id: string;
  short: string;      // "апр"
  year: string;       // "2026"
  sub: string;        // "текущий · 9 дней"
  events: CalendarEvent[];
};

export const CALENDAR: CalendarMonth[] = [
  {
    id: "apr", short: "апр", year: "2026", sub: "текущий · 9 дней",
    events: [
      { id: "apr1", kind: "holiday", letter: "П", date: "28.04", weekday: "вт", inDays: "7д",
        name: "Годовщина с партнёром · 3 года", sub: "обычно ресторан + небольшой подарок",
        fundLabel: "фонд · подарки", amount: "₽ 12 000", amountTone: "warn" },
      { id: "apr2", kind: "other", letter: "Д", date: "30.04", weekday: "чт", inDays: "9д",
        name: "Декларация · самозанятость Q1", sub: "через «Мой налог» · напоминание до 25.05",
        amount: "—" },
    ],
  },
  {
    id: "may", short: "май", year: "2026", sub: "следующий · 31 день",
    events: [
      { id: "may1", kind: "bday",    letter: "Д", date: "03.05", weekday: "вс", inDays: "12д", name: "ДР папы · 62",           sub: "повторяется ежегодно · подарок + поздравление", fundLabel: "фонд · подарки",  amount: "₽ 8 000",  amountTone: "warn" },
      { id: "may2", kind: "holiday", letter: "П", date: "09.05", weekday: "сб", inDays: "18д", name: "День Победы · выходной",  sub: "обычно поездка к родителям", amount: "—" },
      { id: "may3", kind: "bday",    letter: "Д", date: "15.05", weekday: "пт", inDays: "24д", name: "ДР сестры · 28",          sub: "повторяется ежегодно · подарок", fundLabel: "фонд · подарки",  amount: "₽ 10 000", amountTone: "warn" },
      { id: "may4", kind: "buy",     letter: "П", date: "22.05", weekday: "пт", inDays: "31д", name: "Замена планшета",         sub: "крупная покупка · iPad Air",     fundLabel: "фонд · техника",  amount: "₽ 75 000", amountTone: "pos" },
    ],
  },
  {
    id: "jun", short: "июн", year: "2026", sub: "30 дней",
    events: [
      { id: "jun1", kind: "bday",    letter: "Д", date: "11.06", weekday: "чт", inDays: "51д", name: "Твой ДР · 31",            sub: "повторяется ежегодно · ужин с друзьями", fundLabel: "фонд · праздники", amount: "₽ 15 000", amountTone: "warn" },
      { id: "jun2", kind: "holiday", letter: "П", date: "12.06", weekday: "пт", inDays: "52д", name: "День России · выходной",   sub: "длинные выходные 12–14", amount: "—" },
    ],
  },
  {
    id: "jul", short: "июл", year: "2026", sub: "31 день",
    events: [
      { id: "jul1", kind: "trip", letter: "Т", date: "05.07", weekday: "вс", inDays: "75д", name: "Трип · Грузия · 10 дней",     sub: "билеты + отель + еда · бронь в мае", fundLabel: "фонд · Грузия",    amount: "₽ 150 000", amountTone: "acc" },
      { id: "jul2", kind: "bday", letter: "Д", date: "28.07", weekday: "вт", inDays: "98д", name: "ДР мамы · 58",                 sub: "повторяется ежегодно · подарок + цветы", fundLabel: "фонд · подарки",  amount: "₽ 10 000", amountTone: "warn" },
    ],
  },
];

export type Fund = {
  id: string;
  kind: "trip" | "buy" | "vault" | "gift";
  kindLabel: string;
  dueLabel: string;
  name: string;
  sub: string;
  stats: { k: string; v: string; tone?: "pos" | "acc" | "warn" }[];
  pct: number;
  progLeft: React.ReactNode;
  progRight: React.ReactNode;
  hours: string;
  hoursUnit: string;
};

export const FUNDS: Fund[] = [
  {
    id: "f1", kind: "trip", kindLabel: "Трип", dueLabel: "срок 05.07 · 75д",
    name: "Грузия · летний трип", sub: "2 чел · 10 дней · билеты + отель + еда",
    stats: [
      { k: "Цель", v: "₽ 150 000" },
      { k: "Накоплено", v: "₽ 62 000", tone: "acc" },
      { k: "Взнос / мес", v: "₽ 15 000" },
      { k: "Месяцев до", v: "2.5" },
    ],
    pct: 41,
    progLeft: <><b>41%</b> · ₽ 88 000 осталось</>,
    progRight: "темп +5%/нед",
    hours: "74", hoursUnit: "ч · ≈ 9 дней",
  },
  {
    id: "f2", kind: "buy", kindLabel: "Покупка", dueLabel: "срок 22.05 · 31д",
    name: "iPad Air · замена планшета", sub: "11-дюймовый · 256ГБ · кейс + apple pencil",
    stats: [
      { k: "Цель", v: "₽ 75 000" },
      { k: "Накоплено", v: "₽ 68 000", tone: "acc" },
      { k: "Взнос / мес", v: "₽ 8 000" },
      { k: "Осталось", v: "₽ 7 000", tone: "pos" },
    ],
    pct: 91,
    progLeft: <><b>91%</b> · почти готово</>,
    progRight: "перевыполнение возможно",
    hours: "6", hoursUnit: "ч · меньше дня",
  },
  {
    id: "f3", kind: "vault", kindLabel: "Подушка", dueLabel: "без срока · бессрочно",
    name: "Финансовая подушка · 3 месяца", sub: "цель: 3 × средние расходы · ₽ 450 000",
    stats: [
      { k: "Цель", v: "₽ 450 000" },
      { k: "Накоплено", v: "₽ 98 000", tone: "acc" },
      { k: "Взнос / мес", v: "₽ 10 000" },
      { k: "Месяцев до", v: "~35" },
    ],
    pct: 22,
    progLeft: <><b>22%</b> · ₽ 352 000 осталось</>,
    progRight: "низкий приоритет",
    hours: "298", hoursUnit: "ч · ≈ 37 дней",
  },
  {
    id: "f4", kind: "gift", kindLabel: "Подарки", dueLabel: "рекуррентная · годовая",
    name: "Подарки · ДР и праздники", sub: "авто-отчисление · 6 близких + партнёр",
    stats: [
      { k: "Цель (год)", v: "₽ 80 000" },
      { k: "Накоплено", v: "₽ 34 000", tone: "acc" },
      { k: "Взнос / мес", v: "₽ 6 700" },
      { k: "Использ. в 2026", v: "₽ 18 000", tone: "warn" },
    ],
    pct: 43,
    progLeft: <><b>43%</b> · на пути</>,
    progRight: "8 событий впереди",
    hours: "39", hoursUnit: "ч · 5 дней",
  },
  {
    id: "f5", kind: "buy", kindLabel: "Техника", dueLabel: "срок · конец года",
    name: "Апгрейд ноутбука", sub: "MacBook Pro 14 · M5 · через 8 мес",
    stats: [
      { k: "Цель", v: "₽ 280 000" },
      { k: "Накоплено", v: "₽ 22 500", tone: "acc" },
      { k: "Взнос / мес", v: "₽ 2 300" },
      { k: "Месяцев до", v: "8" },
    ],
    pct: 8,
    progLeft: <><b>8%</b> · ₽ 257 500 осталось</>,
    progRight: <span className="warn">нужен +28к/мес</span>,
    hours: "218", hoursUnit: "ч · ≈ 27 дней",
  },
];

export type BigPurchase = {
  id: string;
  icon: string;
  name: string;
  sub: string;
  dueLabel: string;
  pct: number;
  pctTone?: "warn" | "dim";
  hoursMain: string;
  hoursSub: string;
};

export const BIG_PURCHASES: BigPurchase[] = [
  { id: "bp1", icon: "П", name: "iPad Air · 256ГБ",       sub: "замена старого планшета · из фонда «техника»", dueLabel: "22.05 · 31д",    pct: 91, hoursMain: "64 ч работы",  hoursSub: "из них выполнено 58ч" },
  { id: "bp2", icon: "Т", name: "Трип · Грузия · 10 дней", sub: "2 чел · Тбилиси + Казбеги · июл",            dueLabel: "05.07 · 75д",    pct: 41, hoursMain: "127 ч работы", hoursSub: "выполнено 53ч" },
  { id: "bp3", icon: "Н", name: "MacBook Pro 14 · M5",     sub: "апгрейд · фонд «техника»",                    dueLabel: "декабрь · 8 мес", pct: 8,  pctTone: "warn", hoursMain: "237 ч работы", hoursSub: "выполнено 19ч" },
  { id: "bp4", icon: "Д", name: "Диван · замена",          sub: "без фонда · разовая трата",                   dueLabel: "не определён",   pct: 0,  pctTone: "dim",  hoursMain: "127 ч работы", hoursSub: "не начато" },
];

export const UPCOMING_BH = [
  { id: "b1", day: "03", mo: "мая", n: "ДР папы",     m: "62 года · подарок", amount: "₽ 8 000" },
  { id: "b2", day: "15", mo: "мая", n: "ДР сестры",   m: "28 лет · подарок",  amount: "₽ 10 000" },
  { id: "b3", day: "11", mo: "июн", n: "Твой ДР",     m: "31 · ужин с друзьями", amount: "₽ 15 000" },
  { id: "b4", day: "28", mo: "июл", n: "ДР мамы",     m: "58 · цветы + подарок", amount: "₽ 10 000" },
];

export const PLANNING_NEXT = [
  { d: "+7д",  n: "Годовщина",  v: "₽ 12 000" },
  { d: "+12д", n: "ДР папы",     v: "₽ 8 000" },
  { d: "+18д", n: "9 мая",       v: "—" },
];
