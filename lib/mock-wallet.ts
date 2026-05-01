export const WALLET_TOTALS = [
  { k: "чистая сумма",    value: 484620, tone: "acc"  as const, s: "всего по всем счетам" },
  { k: "ликвидно",        value: 312480, tone: "pos"  as const, s: "доступно в банках и крипто" },
  { k: "подушка / вклады", value: 153740, tone: "info" as const, s: "Сбер накоп. + ЛК" },
  { k: "наличка",         value: 18400,  tone: "warn" as const, s: "3 локации · 2 валюты" },
];


export type AccountKind = "card" | "savings" | "cash" | "crypto" | "loan";

export type Account = {
  id: string;
  kind: AccountKind;
  icon: string;
  name: string;
  kindLabel: string;   // short column pill "Дебет" / "Накоп."
  sub: string;         // details after pill
  ccy: string;
  colPill: string;     // second column "Карта" / "Накоп."
  value: string;
  updated: string;
};

export type Institution = {
  id: string;
  logo: "sber" | "tinkoff" | "alfa" | "binance" | "ledger" | "cash";
  letter: string;
  name: string;
  sub: string;
  total: string;
  share: string;
  accounts: Account[];
};

export const INSTITUTIONS: Institution[] = [
  {
    id: "tinkoff", logo: "tinkoff", letter: "Т",
    name: "Тинькофф", sub: "банк · 3 счёта · с 2019",
    total: "₽ 184 320", share: "38% от итого",
    accounts: [
      { id: "t1", kind: "card",    icon: "К", name: "Дебетовая Black Edition", kindLabel: "Дебет", sub: "карта ···4218 · основная",                     ccy: "RUB", colPill: "Карта", value: "142 680 ₽",    updated: "обн 4 мин" },
      { id: "t2", kind: "card",    icon: "В", name: "Валютный счёт",           kindLabel: "Дебет", sub: "безкомиссионный перевод · SWIFT",              ccy: "USD", colPill: "Счёт",  value: "2 145 $",       updated: "≈ 197 540 ₽" },
      { id: "t3", kind: "savings", icon: "К", name: "Копилка · подушка",       kindLabel: "Накоп.", sub: "7.5% годовых · пополнение ежемесячно",         ccy: "RUB", colPill: "Накоп.", value: "41 640 ₽",    updated: "обн 4 мин" },
    ],
  },
  {
    id: "sber", logo: "sber", letter: "С",
    name: "Сбербанк", sub: "банк · 3 счёта · зарплатный",
    total: "₽ 198 920", share: "41% от итого",
    accounts: [
      { id: "s1", kind: "card",    icon: "З", name: "Зарплатная · Сбер Премиум", kindLabel: "Дебет",        sub: "карта ···9812 · зп приходит 10-го",      ccy: "RUB", colPill: "Карта",    value: "87 240 ₽", updated: "обн 4 мин" },
      { id: "s2", kind: "savings", icon: "Н", name: "Накопительный · цели",      kindLabel: "Накоп.",       sub: "8.2% годовых · автоснятие для ипотеки",   ccy: "RUB", colPill: "Накоп.",   value: "98 000 ₽", updated: "обн 4 мин" },
      { id: "s3", kind: "loan",    icon: "И", name: "Ипотечный · привязка к ипотеке", kindLabel: "Автосписание", sub: "списание 28-го · фикс ₽ 57 400",     ccy: "RUB", colPill: "Сервисн.", value: "13 680 ₽", updated: "готов к списанию" },
    ],
  },
  {
    id: "alfa", logo: "alfa", letter: "А",
    name: "Альфа-банк", sub: "банк · 1 счёт · кредитный",
    total: "₽ 54 120", share: "11% от итого",
    accounts: [
      { id: "a1", kind: "card", icon: "К", name: "Мультивалютная · Alfa-X", kindLabel: "Дебет", sub: "RUB + EUR на одной карте · 4.2% на остаток", ccy: "RUB", colPill: "Мульти", value: "33 520 ₽", updated: "обн 12 мин" },
      { id: "a2", kind: "card", icon: "Е", name: "EUR-кошелёк (Alfa-X)",    kindLabel: "Дебет", sub: "для фриланс-платежей",                        ccy: "EUR", colPill: "Мульти", value: "890 €",     updated: "≈ 87 600 ₽ · обн 12 мин" },
    ],
  },
  {
    id: "crypto", logo: "binance", letter: "B",
    name: "Binance · Ledger", sub: "крипто · 2 кошелька · спот + cold",
    total: "₽ 28 860", share: "6% от итого",
    accounts: [
      { id: "c1", kind: "crypto", icon: "Ѣ", name: "Binance · спот",           kindLabel: "Биржа",    sub: "стейкинг USDT · ~4% / год",       ccy: "USDT", colPill: "Крипто", value: "240.00 ₮",  updated: "≈ 22 100 ₽" },
      { id: "c2", kind: "crypto", icon: "Ѣ", name: "Ledger · холодный кошелёк", kindLabel: "Hardware", sub: "долгосрочное хранение · офлайн", ccy: "BTC",  colPill: "Крипто", value: "0.00097 ₿", updated: "≈ 6 760 ₽" },
    ],
  },
];

export type CashStash = {
  id: string;
  sym: string;
  loc: string;
  value: string;
  sub: string;
};

export const CASH_STASH: CashStash[] = [
  { id: "cs1", sym: "RUB", loc: "дома · сейф", value: "12 000 ₽", sub: "резерв наличных" },
  { id: "cs2", sym: "RUB", loc: "кошелёк",     value: "4 400 ₽",  sub: "ежедневные траты" },
  { id: "cs3", sym: "USD", loc: "дома · сейф", value: "200 $",     sub: "≈ 18 420 ₽ · заначка" },
];

export const ARCHIVED = [
  { id: "ar1", icon: "Р", iconKind: "card"   as const, name: "Райффайзен · дебетовая", sub: "закрыт · 2024-11 · остаток переведён", ccy: "RUB", value: "0 ₽", updated: "закрыт 8 мес назад" },
  { id: "ar2", icon: "C", iconKind: "crypto" as const, name: "Coinbase · спот",         sub: "закрыт · 2025-03 · выведено в Binance", ccy: "USD", value: "0 $", updated: "закрыт 1 год назад" },
];

export const INST_SHARES = [
  { k: "Сбер",     pct: 41, color: "var(--pos)"    },
  { k: "Тинькофф", pct: 38, color: "var(--warn)"   },
  { k: "Альфа",    pct: 11, color: "var(--neg)"    },
  { k: "Крипто",    pct: 6, color: "var(--info)"   },
  { k: "Наличка",   pct: 4, color: "var(--muted)"  },
];

export const WALLET_BALANCES = [
  { sym: "RUB",  val: "416 700 ₽",   rub: "86%" },
  { sym: "USD",  val: "2 345 $",      rub: "≈ 216к ₽" },
  { sym: "EUR",  val: "890 €",        rub: "≈ 88к ₽" },
  { sym: "USDT", val: "240 ₮",        rub: "≈ 22к ₽" },
  { sym: "BTC",  val: "0.00097 ₿",    rub: "≈ 7к ₽" },
];
