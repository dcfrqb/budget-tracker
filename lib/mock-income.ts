export const INCOME_KPI = {
  ytd:   { value: 742800, sub: "4 мес · ср ₽ 185 700 / мес" },
  sources: { value: 4, sub: "1 работа · 2 фр · 1 прочее" },
  tax:   { value: 18240, sub: "только подсказки · вручную" },
  rate:  { value: 1180,  sub: "взвеш. · грязный" },
};

export type WorkSource = {
  id: string;
  tag: "Работа" | "Фриланс";
  tagClass: "emp" | "fl";
  since: string;
  stateLabel?: string;
  stateTone?: "warn" | "pos" | "acc";
  title: string;
  sub: string;
  meta: { k: string; v: string; tone?: "pos" | "acc" }[];
  stages?: { name: string; amount: string; state: "done" | "active" | "pending" }[];
  footerL: React.ReactNode;
  footerR: { label: string; tone: "pos" | "acc" };
};

export type ExpectedRow = {
  id: string;
  date: string;      // "10.05"
  weekday: string;   // "пт"
  inDays: string;    // "19d"
  name: string;
  sub: string;
  src: string;
  status: "confirmed" | "expected" | "await";
  statusLabel: string;
  amount: string;
};

export const EXPECTED_INCOME: ExpectedRow[] = [
  { id: "e1", date: "10.05", weekday: "пт", inDays: "19d", name: "Зарплата · Acme — май",       sub: "работа · регулярно · подтв.",          src: "Acme",   status: "confirmed", statusLabel: "Подтв.",    amount: "+₽ 120 000" },
  { id: "e2", date: "15.05", weekday: "ср", inDays: "24d", name: "Hatch · релиз среднего этапа", sub: "фриланс · по контракту · триггер этапа", src: "Hatch", status: "await",     statusLabel: "Ожидает",   amount: "+€ 1 200"   },
  { id: "e3", date: "25.05", weekday: "сб", inDays: "34d", name: "Квартальная премия · Q1 сверка", sub: "работа · плав. · ±15%",              src: "Acme",   status: "expected",  statusLabel: "Ожидаемые", amount: "+₽ 45 000"  },
  { id: "e4", date: "10.06", weekday: "ср", inDays: "50d", name: "Зарплата · Acme — июн",       sub: "работа · регулярно",                   src: "Acme",   status: "confirmed", statusLabel: "Подтв.",    amount: "+₽ 120 000" },
  { id: "e5", date: "20.06", weekday: "сб", inDays: "60d", name: "Hatch · финальный этап",       sub: "фриланс · по контракту",               src: "Hatch",  status: "expected",  statusLabel: "Ожидаемые", amount: "+€ 1 200"   },
  { id: "e6", date: "10.07", weekday: "пт", inDays: "80d", name: "Зарплата · Acme — июл",       sub: "работа · регулярно",                   src: "Acme",   status: "expected",  statusLabel: "Ожидаемые", amount: "+₽ 120 000" },
  { id: "e7", date: "15.07", weekday: "ср", inDays: "85d", name: "Отпускные · лето",            sub: "работа · отпускные",                   src: "Acme",   status: "expected",  statusLabel: "Ожидаемые", amount: "+₽ 52 000"  },
];

export type OtherIncomeRow = {
  id: string;
  icon: string;
  name: string;
  sub: string;
  src: string;
  date: string;
  amount: string;
  amountTone?: "warn" | "acc" | "info";
};

export const OTHER_INCOME: OtherIncomeRow[] = [
  { id: "o1", icon: "G", name: "Подарок на ДР · родители",      sub: "разово · неформально · без налога", src: "Наличка",   date: "15 мар 2026", amount: "+₽ 10 000" },
  { id: "o2", icon: "C", name: "Кэшбэк · Тинькофф · мар",        sub: "банк · регулярно",                 src: "Тинькофф",   date: "01 апр 2026", amount: "+₽ 2 140" },
  { id: "o3", icon: "D", name: "USDT дивиденд · стейкинг",       sub: "крипта · месяц · немного",         src: "Binance",    date: "05 апр 2026", amount: "+$ 42" },
  { id: "o4", icon: "R", name: "Возврат Ozon · отменённый заказ", sub: "возврат · в ожидании",            src: "Тинькофф",   date: "ожидание",     amount: "+₽ 8 900", amountTone: "warn" },
  { id: "o5", icon: "S", name: "Самозанятость задекл. · апр",     sub: "действие · чек ФНС · вручную",    src: "Акт",         date: "+ заявить",   amount: "заявить",   amountTone: "acc" },
];

export type IncomeSignal = {
  id: string;
  kind: "acc" | "warn" | "info";
  k: string;
  mHtml: string;
};

export const INCOME_SIGNALS: IncomeSignal[] = [
  { id: "s1", kind: "acc",  k: "подсказка · налог (self-employed 6%)",    mHtml: "Заявленный фриланс за апр: <b>₽ 188 400</b> → обязательство ≈ <b>₽ 11 304</b>. Плати через «Мой налог», когда готов. Не проводится авто." },
  { id: "s2", kind: "info", k: "подсказка · 50/30/20 on last salary",     mHtml: "Зарплата <b>₽ 120 000</b> получ. 10.04 → <b>нужды 60к</b> · <b>хотелки 36к</b> · <b>накоп. 24к</b>. Распредели вручную если хочешь." },
  { id: "s3", kind: "warn", k: "сигнал · нестабильность дохода",           mHtml: "Доля фриланса в общем доходе: <b>24%</b> этот квартал (было 12%). Цель буфера: <b>3 месяца</b> расходов." },
];

export const INCOME_SUMMARY_MONTH = {
  fact: 188400,
  plan: "₽ 260 000",
  rows: [
    { k: "работа",   v: "₽ 120 000" },
    { k: "фриланс",  v: "₽ 57 000"  },
    { k: "прочее",   v: "₽ 11 400"  },
  ],
};

export const INCOME_UPCOMING = [
  { d: "+19d", n: "Зарплата",     v: "+₽ 120 000" },
  { d: "+24d", n: "Hatch сред",   v: "+€ 1 200"   },
  { d: "+34d", n: "Q1 премия",    v: "+₽ 45 000"  },
];
