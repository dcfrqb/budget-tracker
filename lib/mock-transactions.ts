/* Mock data for the Transactions page. Will be replaced by Prisma queries later. */

export type TxnKind = "inc" | "exp" | "xfr" | "loan";
export type TxnStatus = "planned" | "partial" | "done" | "missed" | "cancel";

export type Txn = {
  id: string;
  kind: TxnKind;
  time: string;
  name: string;
  cat: string;
  note?: string;
  noteTone?: "acc" | "info" | "warn";
  account: string;        // right-column label ("Тинькофф", "→ Сбер")
  status: TxnStatus;
  statusLabel: string;
  amount: string;
  amountTone?: "pos" | "neg" | "info" | "warn" | "dim";
  amountStrike?: boolean;
  reimbursable?: boolean;
};

export type TxnDay = {
  date: string;          // "21.04"
  weekday: string;       // "пн · сегодня"
  totals: { label: string; value: string; tone: "pos" | "info" | "warn" | "mut" }[];
  txns: Txn[];
};

export const TXN_DAYS: TxnDay[] = [
  {
    date: "21.04",
    weekday: "пн · сегодня",
    totals: [
      { label: "приток", value: "+₽ 0",       tone: "pos"  },
      { label: "отток",  value: "−₽ 4 860",   tone: "info" },
    ],
    txns: [
      {
        id: "t1", kind: "exp", time: "11:42",
        name: "Пятёрочка · продукты",
        cat: "Продукты", note: "Тинькофф · карта ···4218",
        account: "Тинькофф",
        status: "done", statusLabel: "Выполнено",
        amount: "−₽ 1 860", amountTone: "info",
      },
      {
        id: "t2", kind: "exp", time: "09:14",
        name: "Яндекс Такси",
        cat: "Транспорт", note: "компенс. · Acme · ожид. ₽ 3 000", noteTone: "warn",
        account: "Сбер",
        status: "done", statusLabel: "Выполнено",
        amount: "−₽ 3 000", amountTone: "info",
        reimbursable: true,
      },
    ],
  },
  {
    date: "20.04",
    weekday: "вс",
    totals: [
      { label: "приток", value: "+₽ 1 500",  tone: "pos"  },
      { label: "отток",  value: "−₽ 9 430",  tone: "info" },
    ],
    txns: [
      { id: "t3", kind: "exp", time: "20:05", name: "Додо Пицца", cat: "Кафе", note: "Тинькофф", account: "Тинькофф", status: "done", statusLabel: "Выполнено", amount: "−₽ 1 480", amountTone: "info" },
      { id: "t4", kind: "exp", time: "15:30", name: "Uniqlo · футболка + носки", cat: "Одежда", note: "Сбер", account: "Сбер", status: "done", statusLabel: "Выполнено", amount: "−₽ 4 980", amountTone: "info" },
      { id: "t5", kind: "exp", time: "11:00", name: "ВкусВилл · продукты", cat: "Продукты", note: "Тинькофф", account: "Тинькофф", status: "done", statusLabel: "Выполнено", amount: "−₽ 2 970", amountTone: "info" },
      { id: "t6", kind: "inc", time: "10:12", name: "Кэшбэк · Тинькофф", cat: "Прочий доход", note: "авто-запись", account: "Тинькофф", status: "done", statusLabel: "Выполнено", amount: "+₽ 1 500", amountTone: "pos" },
    ],
  },
  {
    date: "18.04",
    weekday: "пт",
    totals: [
      { label: "приток", value: "+₽ 45 000",  tone: "pos"  },
      { label: "отток",  value: "−₽ 24 800",  tone: "info" },
    ],
    txns: [
      { id: "t7",  kind: "inc", time: "18:02", name: "Фриланс · Acme Design Sprint", cat: "Фриланс", note: "подск. налог · 6% = ₽ 2 700", noteTone: "acc", account: "Тинькофф", status: "done", statusLabel: "Выполнено", amount: "+₽ 45 000", amountTone: "pos" },
      { id: "t8",  kind: "xfr", time: "16:40", name: "Перевод · Тинькофф → Сбер (копилка)", cat: "Переводы", note: "курс 1:1 · без комиссии", account: "→ Сбер", status: "done", statusLabel: "Выполнено", amount: "₽ 20 000", amountTone: "warn" },
      { id: "t9",  kind: "exp", time: "13:22", name: "Бургер Кинг · ужин", cat: "Кафе", note: "Тинькофф", account: "Тинькофф", status: "done", statusLabel: "Выполнено", amount: "−₽ 1 320", amountTone: "info" },
      { id: "t10", kind: "exp", time: "11:15", name: "Метро · Тройка пополнение", cat: "Транспорт", note: "Сбер", account: "Сбер", status: "done", statusLabel: "Выполнено", amount: "−₽ 3 000", amountTone: "info" },
      { id: "t11", kind: "exp", time: "09:44", name: "Аптека · лекарства", cat: "Здоровье", note: "Сбер", account: "Сбер", status: "done", statusLabel: "Выполнено", amount: "−₽ 480", amountTone: "info" },
    ],
  },
  {
    date: "15.04",
    weekday: "вт",
    totals: [
      { label: "план",   value: "2 ожидается", tone: "mut"  },
      { label: "отток",  value: "−₽ 12 400",    tone: "info" },
    ],
    txns: [
      { id: "t12", kind: "exp", time: "20:00", name: "Зал · абонемент", cat: "Здоровье", note: "Сбер · регулярно", account: "Сбер", status: "planned", statusLabel: "Запланир.", amount: "−₽ 4 500", amountTone: "dim" },
      { id: "t13", kind: "inc", time: "14:00", name: "Фриланс · Hatch онбординг · этап 2/3", cat: "Фриланс", note: "частично · ожид. ₽ 30 000 · получ. ₽ 12 000", noteTone: "warn", account: "Тинькофф", status: "partial", statusLabel: "Частично", amount: "+₽ 12 000", amountTone: "pos" },
      { id: "t14", kind: "exp", time: "12:10", name: "Лента · продукты", cat: "Продукты", note: "Тинькофф", account: "Тинькофф", status: "done", statusLabel: "Выполнено", amount: "−₽ 3 420", amountTone: "info" },
      { id: "t15", kind: "exp", time: "09:00", name: "Netflix · стандарт", cat: "Подписки", note: "Тинькофф · авто", account: "Тинькофф", status: "done", statusLabel: "Выполнено", amount: "−₽ 499", amountTone: "info" },
    ],
  },
  {
    date: "12.04",
    weekday: "сб",
    totals: [
      { label: "отток", value: "−₽ 6 840", tone: "info" },
      { label: "",       value: "1 отменено", tone: "mut" },
    ],
    txns: [
      { id: "t16", kind: "loan", time: "18:00", name: "Выдача · Саша (залог за квартиру)", cat: "Личный долг", note: "вернёт до 30.05 · ₽ 25 000 остаток", account: "Наличка", status: "done", statusLabel: "Выполнено", amount: "−₽ 25 000", amountTone: "neg" },
      { id: "t17", kind: "exp", time: "14:30", name: "Кофемания · бранч с М.", cat: "Кафе", note: "Тинькофф", account: "Тинькофф", status: "done", statusLabel: "Выполнено", amount: "−₽ 2 840", amountTone: "info" },
      { id: "t18", kind: "exp", time: "—",    name: "Ozon · наушники", cat: "Электроника", note: "заказ отменён · возврат в ожидании", account: "Тинькофф", status: "cancel", statusLabel: "Отменено", amount: "−₽ 8 900", amountTone: "dim", amountStrike: true },
    ],
  },
  {
    date: "10.04",
    weekday: "чт · день зп",
    totals: [
      { label: "приток", value: "+₽ 120 000",  tone: "pos"  },
      { label: "отток",  value: "−₽ 57 400",    tone: "info" },
    ],
    txns: [
      { id: "t19", kind: "inc",  time: "10:00", name: "Зарплата · Acme — апр", cat: "Работа", note: "подск. 50/30/20 · нужды 60к · хотелки 36к · накоп. 24к", noteTone: "info", account: "Тинькофф", status: "done", statusLabel: "Выполнено", amount: "+₽ 120 000", amountTone: "pos" },
      { id: "t20", kind: "loan", time: "10:15", name: "Ипотека · Сбер — апр payment", cat: "Займы", note: "тело 38 140 + %% 19 260", account: "Сбер", status: "done", statusLabel: "Выполнено", amount: "−₽ 57 400", amountTone: "neg" },
    ],
  },
];

export type PersonalDebt = {
  id: string;
  dir: "out" | "in";           // out = я дал в долг, in = мне дали
  dirLabel: "выдал" | "взял";
  name: string;
  sub: string;
  since: string;
  until: string;
  amount: string;              // display "−₽ 25 000" / "+₽ 2 000"
  amountTone: "pos" | "neg";
  progressPct: number;         // 0..100
  progressLabel: string;       // "возвращено 0 / 25 000"
};

export const PERSONAL_DEBTS: PersonalDebt[] = [
  {
    id: "d1", dir: "out", dirLabel: "выдал",
    name: "Саша · залог за квартиру",
    sub: "ожидаю 2 возврата · следующий ₽ 12 500 на 15.05",
    since: "12.04", until: "30.05",
    amount: "−₽ 25 000", amountTone: "neg",
    progressPct: 0, progressLabel: "возвращено 0 / 25 000",
  },
  {
    id: "d2", dir: "out", dirLabel: "выдал",
    name: "Миша · заём на ноут",
    sub: "неформально · 3 возврата · ₽ 4к остаток",
    since: "02.03", until: "без срока",
    amount: "−₽ 4 000", amountTone: "neg",
    progressPct: 66, progressLabel: "возвращено 8 000 / 12 000",
  },
  {
    id: "d3", dir: "in", dirLabel: "взял",
    name: "Папа · срочный ветеринар",
    sub: "договорились вернуть к 01.05 · 1 частично",
    since: "20.02", until: "01.05",
    amount: "+₽ 2 000", amountTone: "pos",
    progressPct: 71, progressLabel: "верн. 5 000 / 7 000",
  },
];

export const TXN_PERIOD_SUMMARY = {
  inflow:    { value: 188400, count: 21, avg: "ср ₽ 8 971" },
  outflow:   { value: 142310, count: 24, avg: "ср ₽ 5 929" },
  transfers: { value: 48000,  count: 3,  avg: "Тинькофф → Сбер" },
  net:       { value: 46090,  note: "кон. мес ≈ +₽ 118 000" },
};

export const TXN_FILTER_SUMMARY = {
  found:       "48 транз.",
  inflow:      "+₽ 188 400",
  outflow:     "−₽ 142 310",
  transfers:   "₽ 48 000",
  reimburse:   "₽ 3 000 в ожидании",
  avgPerDay:   "−₽ 4 743",
};
