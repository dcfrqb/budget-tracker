/**
 * Budget Tracker — idempotent seed.
 *
 * Заливает данные из code/lib/mock-*.ts в БД для единственного пользователя
 * (DEFAULT_USER_ID). Скрипт очищает всё под этим user'ом и заливает заново —
 * безопасно гонять многократно в dev.
 *
 * Запуск: `npm run seed` или `npx prisma db seed`.
 */

import { PrismaClient, AccountKind, BudgetMode, CategoryKind, DebtDirection, FamilyRole, FundKind, Gender, InstitutionKind, PlannedEventKind, Scope, SharingType, TransactionKind, TransactionStatus, WorkKind } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { DEFAULT_CURRENCY, DEFAULT_USER_EMAIL, DEFAULT_USER_ID, DEFAULT_USER_NAME, SUPPORTED_CURRENCIES } from "../lib/constants";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const NOW = new Date("2026-04-22T12:00:00Z");

function d(iso: string): Date {
  return new Date(iso);
}

// ────────────────────────────────────────────────────────────────
// 1. Currencies + exchange rates (справочник, upsert)
// ────────────────────────────────────────────────────────────────
async function seedCurrencies() {
  for (const c of SUPPORTED_CURRENCIES) {
    await db.currency.upsert({
      where: { code: c.code },
      create: c,
      update: c,
    });
  }

  // Курсы: RATES из mock.ts + FX_RATES из mock-wallet.ts
  const rates: Array<[string, string, string]> = [
    ["USD", "RUB", "92.10"],
    ["EUR", "RUB", "98.40"],
    ["GEL", "RUB", "34.20"],
    ["BTC", "USD", "69420"],
    ["USDT", "RUB", "92.10"],
  ];
  await db.exchangeRate.deleteMany({});
  for (const [from, to, rate] of rates) {
    await db.exchangeRate.create({
      data: { fromCcy: from, toCcy: to, rate, recordedAt: NOW },
    });
  }
}

// ────────────────────────────────────────────────────────────────
// 2. Покатываем user (fresh wipe)
// ────────────────────────────────────────────────────────────────
async function wipeUser() {
  // Cascade от User снесёт всё что на нём висит. FamilyOwner каскадит на Family.
  await db.user.deleteMany({ where: { id: DEFAULT_USER_ID } });
}

async function seedUser() {
  await db.user.create({
    data: {
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      name: DEFAULT_USER_NAME,
      gender: Gender.MALE,
      budgetSettings: {
        create: {
          activeMode: BudgetMode.NORMAL,
          primaryCurrencyCode: DEFAULT_CURRENCY,
        },
      },
    },
  });
}

// ────────────────────────────────────────────────────────────────
// 3. Institutions + Accounts (из mock-wallet.ts)
// ────────────────────────────────────────────────────────────────
const INSTITUTION_IDS = {
  tinkoff: "inst_tinkoff",
  sber: "inst_sber",
  alfa: "inst_alfa",
  crypto: "inst_crypto",
  cash: "inst_cash",
};

const ACCOUNT_IDS = {
  tinkCard: "acc_tink_card",
  tinkUsd: "acc_tink_usd",
  tinkSavings: "acc_tink_savings",
  sberSalary: "acc_sber_salary",
  sberSavings: "acc_sber_savings",
  sberMortgage: "acc_sber_mortgage",
  alfaRub: "acc_alfa_rub",
  alfaEur: "acc_alfa_eur",
  binance: "acc_binance",
  ledger: "acc_ledger",
  cashSafeRub: "acc_cash_safe_rub",
  cashWallet: "acc_cash_wallet",
  cashSafeUsd: "acc_cash_safe_usd",
};

async function seedAccounts() {
  await db.institution.createMany({
    data: [
      { id: INSTITUTION_IDS.tinkoff, userId: DEFAULT_USER_ID, name: "Тинькофф", kind: InstitutionKind.BANK, logo: "tinkoff", sub: "банк · 3 счёта · с 2019", sortOrder: 1 },
      { id: INSTITUTION_IDS.sber,    userId: DEFAULT_USER_ID, name: "Сбербанк", kind: InstitutionKind.BANK, logo: "sber",    sub: "банк · 3 счёта · зарплатный", sortOrder: 2 },
      { id: INSTITUTION_IDS.alfa,    userId: DEFAULT_USER_ID, name: "Альфа-банк", kind: InstitutionKind.BANK, logo: "alfa",  sub: "банк · 1 счёт · кредитный", sortOrder: 3 },
      { id: INSTITUTION_IDS.crypto,  userId: DEFAULT_USER_ID, name: "Binance · Ledger", kind: InstitutionKind.CRYPTO, logo: "binance", sub: "крипто · 2 кошелька", sortOrder: 4 },
      { id: INSTITUTION_IDS.cash,    userId: DEFAULT_USER_ID, name: "Наличка", kind: InstitutionKind.CASH, logo: "cash",     sub: "3 локации · 2 валюты", sortOrder: 5 },
    ],
  });

  await db.account.createMany({
    data: [
      // Тинькофф
      { id: ACCOUNT_IDS.tinkCard,    userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.tinkoff, kind: AccountKind.CARD,    name: "Дебетовая Black Edition", currencyCode: "RUB", balance: "142680.00", sub: "карта ···4218 · основная", sortOrder: 1 },
      { id: ACCOUNT_IDS.tinkUsd,     userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.tinkoff, kind: AccountKind.CARD,    name: "Валютный счёт",           currencyCode: "USD", balance: "2145.00",   sub: "безкомиссионный · SWIFT", sortOrder: 2 },
      { id: ACCOUNT_IDS.tinkSavings, userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.tinkoff, kind: AccountKind.SAVINGS, name: "Копилка · подушка",       currencyCode: "RUB", balance: "41640.00",  sub: "7.5% годовых", annualRatePct: "7.500", sortOrder: 3 },
      // Сбер
      { id: ACCOUNT_IDS.sberSalary,   userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.sber, kind: AccountKind.CARD,    name: "Зарплатная · Сбер Премиум", currencyCode: "RUB", balance: "87240.00", sub: "карта ···9812 · зп 10-го", sortOrder: 1 },
      { id: ACCOUNT_IDS.sberSavings,  userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.sber, kind: AccountKind.SAVINGS, name: "Накопительный · цели",      currencyCode: "RUB", balance: "98000.00", sub: "8.2% годовых", annualRatePct: "8.200", sortOrder: 2 },
      { id: ACCOUNT_IDS.sberMortgage, userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.sber, kind: AccountKind.LOAN,    name: "Ипотечный · привязка",     currencyCode: "RUB", balance: "13680.00", sub: "списание 28-го · ₽ 57 400", sortOrder: 3 },
      // Альфа
      { id: ACCOUNT_IDS.alfaRub, userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.alfa, kind: AccountKind.CARD, name: "Мультивалютная · Alfa-X", currencyCode: "RUB", balance: "33520.00", sub: "4.2% на остаток", sortOrder: 1 },
      { id: ACCOUNT_IDS.alfaEur, userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.alfa, kind: AccountKind.CARD, name: "EUR-кошелёк (Alfa-X)",    currencyCode: "EUR", balance: "890.00",   sub: "для фриланс-платежей", sortOrder: 2 },
      // Крипто
      { id: ACCOUNT_IDS.binance, userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.crypto, kind: AccountKind.CRYPTO, name: "Binance · спот",           currencyCode: "USDT", balance: "240.00",    sub: "стейкинг ~4% / год" },
      { id: ACCOUNT_IDS.ledger,  userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.crypto, kind: AccountKind.CRYPTO, name: "Ledger · холодный кошелёк", currencyCode: "BTC",  balance: "0.00097000", sub: "долгосрочное хранение" },
      // Наличка
      { id: ACCOUNT_IDS.cashSafeRub, userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.cash, kind: AccountKind.CASH, name: "Наличные · сейф RUB",    currencyCode: "RUB", balance: "12000.00", location: "дома · сейф" },
      { id: ACCOUNT_IDS.cashWallet,  userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.cash, kind: AccountKind.CASH, name: "Кошелёк",                 currencyCode: "RUB", balance: "4400.00",  location: "кошелёк" },
      { id: ACCOUNT_IDS.cashSafeUsd, userId: DEFAULT_USER_ID, institutionId: INSTITUTION_IDS.cash, kind: AccountKind.CASH, name: "Наличные · сейф USD",    currencyCode: "USD", balance: "200.00",   location: "дома · сейф" },
      // Архивные
      { id: "acc_archived_raif", userId: DEFAULT_USER_ID, institutionId: null, kind: AccountKind.CARD,   name: "Райффайзен · дебетовая", currencyCode: "RUB", balance: "0.00", isArchived: true, archivedAt: d("2024-11-01") },
      { id: "acc_archived_cb",   userId: DEFAULT_USER_ID, institutionId: null, kind: AccountKind.CRYPTO, name: "Coinbase · спот",         currencyCode: "USD", balance: "0.00", isArchived: true, archivedAt: d("2025-03-01") },
    ],
  });
}

// ────────────────────────────────────────────────────────────────
// 4. Categories (базовый набор + лимиты из mock-analytics MODES)
// ────────────────────────────────────────────────────────────────
const CATEGORY_IDS = {
  salary: "cat_salary",
  freelance: "cat_freelance",
  other: "cat_other_income",
  cashback: "cat_cashback",
  products: "cat_products",
  cafe: "cat_cafe",
  transport: "cat_transport",
  health: "cat_health",
  clothes: "cat_clothes",
  entertainment: "cat_entertainment",
  home: "cat_home",
  auto: "cat_auto",
  utilities: "cat_utilities",
  internet: "cat_internet",
  education: "cat_education",
  trip: "cat_trip",
  electronics: "cat_electronics",
  loans: "cat_loans",
  subs: "cat_subs",
  transfers: "cat_transfers",
  debt: "cat_debt",
  taxes: "cat_taxes",
};

async function seedCategories() {
  // Income
  await db.category.createMany({
    data: [
      { id: CATEGORY_IDS.salary,    userId: DEFAULT_USER_ID, name: "Работа",        kind: CategoryKind.INCOME, icon: "W", color: "var(--pos)",   sortOrder: 1 },
      { id: CATEGORY_IDS.freelance, userId: DEFAULT_USER_ID, name: "Фриланс",       kind: CategoryKind.INCOME, icon: "F", color: "var(--accent)", sortOrder: 2 },
      { id: CATEGORY_IDS.other,     userId: DEFAULT_USER_ID, name: "Прочий доход",  kind: CategoryKind.INCOME, icon: "O", color: "var(--info)",   sortOrder: 3 },
      { id: CATEGORY_IDS.cashback,  userId: DEFAULT_USER_ID, name: "Кэшбэк",        kind: CategoryKind.INCOME, icon: "C", color: "var(--info)",   sortOrder: 4 },
      { id: CATEGORY_IDS.transfers, userId: DEFAULT_USER_ID, name: "Переводы",      kind: CategoryKind.INCOME, icon: "T", color: "var(--warn)",   sortOrder: 5 },
    ],
  });

  // Expenses. Лимиты из MODES (mock-analytics) где есть.
  await db.category.createMany({
    data: [
      { id: CATEGORY_IDS.products,      userId: DEFAULT_USER_ID, name: "Продукты",            kind: CategoryKind.EXPENSE, icon: "P", color: "#F85149", sortOrder: 1,  limitEconomy: "24000", limitNormal: "36000", limitFree: "45000" },
      { id: CATEGORY_IDS.cafe,          userId: DEFAULT_USER_ID, name: "Кафе и рестораны",    kind: CategoryKind.EXPENSE, icon: "K", color: "#D29922", sortOrder: 2,  limitEconomy: "4000",  limitNormal: "12000", limitFree: "18000" },
      { id: CATEGORY_IDS.transport,     userId: DEFAULT_USER_ID, name: "Транспорт",           kind: CategoryKind.EXPENSE, icon: "M", color: "#79C0FF", sortOrder: 3 },
      { id: CATEGORY_IDS.health,        userId: DEFAULT_USER_ID, name: "Здоровье",            kind: CategoryKind.EXPENSE, icon: "H", color: "#58D3A3", sortOrder: 4 },
      { id: CATEGORY_IDS.clothes,       userId: DEFAULT_USER_ID, name: "Одежда",              kind: CategoryKind.EXPENSE, icon: "O", color: "#BC8CFF", sortOrder: 5,  limitEconomy: "2000",  limitNormal: "8000",  limitFree: "14000" },
      { id: CATEGORY_IDS.entertainment, userId: DEFAULT_USER_ID, name: "Развлечения",         kind: CategoryKind.EXPENSE, icon: "E", color: "#3FB950", sortOrder: 6,  limitEconomy: "3000",  limitNormal: "10000", limitFree: "15000" },
      { id: CATEGORY_IDS.home,          userId: DEFAULT_USER_ID, name: "Дом",                 kind: CategoryKind.EXPENSE, icon: "D", color: "#58D3A3", sortOrder: 7 },
      { id: CATEGORY_IDS.auto,          userId: DEFAULT_USER_ID, name: "Авто",                kind: CategoryKind.EXPENSE, icon: "A", color: "#79C0FF", sortOrder: 8 },
      { id: CATEGORY_IDS.utilities,     userId: DEFAULT_USER_ID, name: "ЖКХ",                 kind: CategoryKind.EXPENSE, icon: "U", color: "#D29922", sortOrder: 9 },
      { id: CATEGORY_IDS.internet,      userId: DEFAULT_USER_ID, name: "Интернет и связь",    kind: CategoryKind.EXPENSE, icon: "I", color: "#79C0FF", sortOrder: 10 },
      { id: CATEGORY_IDS.education,     userId: DEFAULT_USER_ID, name: "Образование",         kind: CategoryKind.EXPENSE, icon: "Ed", color: "#58D3A3", sortOrder: 11 },
      { id: CATEGORY_IDS.trip,          userId: DEFAULT_USER_ID, name: "Поездки",             kind: CategoryKind.EXPENSE, icon: "T", color: "#BC8CFF", sortOrder: 12 },
      { id: CATEGORY_IDS.electronics,   userId: DEFAULT_USER_ID, name: "Электроника",         kind: CategoryKind.EXPENSE, icon: "E", color: "#79C0FF", sortOrder: 13 },
      { id: CATEGORY_IDS.loans,         userId: DEFAULT_USER_ID, name: "Займы и кредиты",     kind: CategoryKind.EXPENSE, icon: "L", color: "var(--loan)", sortOrder: 14 },
      { id: CATEGORY_IDS.subs,          userId: DEFAULT_USER_ID, name: "Подписки",            kind: CategoryKind.EXPENSE, icon: "S", color: "var(--sub)", sortOrder: 15 },
      { id: CATEGORY_IDS.debt,          userId: DEFAULT_USER_ID, name: "Личный долг",         kind: CategoryKind.EXPENSE, icon: "Δ", color: "var(--warn)", sortOrder: 16 },
      { id: CATEGORY_IDS.taxes,         userId: DEFAULT_USER_ID, name: "Налоги",              kind: CategoryKind.EXPENSE, icon: "T", color: "var(--tax)", sortOrder: 17 },
    ],
  });
}

// ────────────────────────────────────────────────────────────────
// 5. Work sources (mock-income)
// ────────────────────────────────────────────────────────────────
const WORK_IDS = {
  acme: "ws_acme_employment",
  hatch: "ws_hatch_freelance",
  oneoff: "ws_oneoff_gift",
};

async function seedWorkSources() {
  await db.workSource.createMany({
    data: [
      { id: WORK_IDS.acme,   userId: DEFAULT_USER_ID, name: "Acme · Senior Designer",  kind: WorkKind.EMPLOYMENT, currencyCode: "RUB", baseAmount: "120000", hourlyRate: "750",   payDay: 10, taxRatePct: "13.00", note: "зарплата 10-го, премия Q1" },
      { id: WORK_IDS.hatch,  userId: DEFAULT_USER_ID, name: "Hatch · фриланс-контракт", kind: WorkKind.FREELANCE,  currencyCode: "EUR", baseAmount: null,     hourlyRate: "45",    taxRatePct: "6.00", note: "этапы 1/3 · 2/3 · 3/3" },
      { id: WORK_IDS.oneoff, userId: DEFAULT_USER_ID, name: "Разовое / подарки",       kind: WorkKind.ONE_TIME,   currencyCode: "RUB", isActive: false },
    ],
  });
}

// ────────────────────────────────────────────────────────────────
// 6. Loan + payments (ипотека Сбер)
// ────────────────────────────────────────────────────────────────
const LOAN_MORTGAGE = "loan_mortgage_sber";

async function seedLoans() {
  await db.loan.create({
    data: {
      id: LOAN_MORTGAGE,
      userId: DEFAULT_USER_ID,
      name: "Ипотека · Сбер",
      principal: "4500000",
      annualRatePct: "9.500",
      termMonths: 240,
      startDate: d("2022-09-28"),
      currencyCode: "RUB",
      accountId: ACCOUNT_IDS.sberMortgage,
      note: "авто · фикс · 28-го числа",
    },
  });

  await db.loanPayment.createMany({
    data: [
      { loanId: LOAN_MORTGAGE, paidAt: d("2026-04-10"), totalAmount: "57400", principalPart: "38140", interestPart: "19260" },
      { loanId: LOAN_MORTGAGE, paidAt: d("2026-03-10"), totalAmount: "57400", principalPart: "37950", interestPart: "19450" },
      { loanId: LOAN_MORTGAGE, paidAt: d("2026-02-10"), totalAmount: "57400", principalPart: "37760", interestPart: "19640" },
    ],
  });
}

// ────────────────────────────────────────────────────────────────
// 7. Personal debts (mock-transactions PERSONAL_DEBTS)
// ────────────────────────────────────────────────────────────────
const DEBT_IDS = {
  sasha: "dbt_sasha",
  misha: "dbt_misha",
  papa: "dbt_papa",
};

async function seedPersonalDebts() {
  await db.personalDebt.createMany({
    data: [
      { id: DEBT_IDS.sasha, userId: DEFAULT_USER_ID, direction: DebtDirection.LENT,     counterparty: "Саша",  principal: "25000", currencyCode: "RUB", openedAt: d("2026-04-12"), dueAt: d("2026-05-30"), note: "залог за квартиру" },
      { id: DEBT_IDS.misha, userId: DEFAULT_USER_ID, direction: DebtDirection.LENT,     counterparty: "Миша",  principal: "12000", currencyCode: "RUB", openedAt: d("2026-03-02"),                       note: "неформально · заём на ноут" },
      { id: DEBT_IDS.papa,  userId: DEFAULT_USER_ID, direction: DebtDirection.BORROWED, counterparty: "Папа",  principal: "7000",  currencyCode: "RUB", openedAt: d("2026-02-20"), dueAt: d("2026-05-01"), note: "срочный ветеринар" },
    ],
  });
}

// ────────────────────────────────────────────────────────────────
// 8. Subscriptions + shares (mock-expenses + mock-family)
// ────────────────────────────────────────────────────────────────
const SUB_IDS = {
  netflix: "sub_netflix",
  spotify: "sub_spotify",
  icloud: "sub_icloud",
  yandex: "sub_yandex",
  figma: "sub_figma",
  nyt: "sub_nyt",
  adobe: "sub_adobe",
  gym: "sub_gym",
};

// ────────────────────────────────────────────────────────────────
// 9. Long projects
// ────────────────────────────────────────────────────────────────
const PROJECT_IDS = {
  kitchen: "proj_kitchen",
  autoService: "proj_auto_service",
  englishB2: "proj_english_b2",
  georgiaTrip: "proj_georgia_trip",
};

async function seedLongProjects() {
  await db.longProject.createMany({
    data: [
      { id: PROJECT_IDS.kitchen,     userId: DEFAULT_USER_ID, name: "Ремонт кухни",       budget: "200000", currencyCode: "RUB", categoryId: CATEGORY_IDS.home,      startDate: d("2026-01-01"), endDate: d("2026-06-30"), note: "Ikea, плитка, сантехник" },
      { id: PROJECT_IDS.autoService, userId: DEFAULT_USER_ID, name: "Авто · плановое ТО",  budget: "70000",  currencyCode: "RUB", categoryId: CATEGORY_IDS.auto,      startDate: d("2026-03-01"), endDate: d("2026-08-31"), note: "масло, шины, тормоза" },
      { id: PROJECT_IDS.englishB2,   userId: DEFAULT_USER_ID, name: "Курс языка · B2",     budget: "50000",  currencyCode: "RUB", categoryId: CATEGORY_IDS.education, startDate: d("2025-10-01"), endDate: d("2026-05-31"), note: "репетитор 2р/нед" },
      { id: PROJECT_IDS.georgiaTrip, userId: DEFAULT_USER_ID, name: "Летний трип · Грузия", budget: "150000", currencyCode: "RUB", categoryId: CATEGORY_IDS.trip,      startDate: d("2026-07-01"), endDate: d("2026-08-01"), note: "билеты, отель, еда" },
    ],
  });
}

// ────────────────────────────────────────────────────────────────
// 10. Funds + planned events (mock-planning)
// ────────────────────────────────────────────────────────────────
const FUND_IDS = {
  georgia: "fund_georgia",
  ipad: "fund_ipad",
  vault: "fund_vault",
  gifts: "fund_gifts",
  macbook: "fund_macbook",
};

async function seedFunds() {
  await db.fund.createMany({
    data: [
      { id: FUND_IDS.georgia, userId: DEFAULT_USER_ID, kind: FundKind.TRIP,  name: "Грузия · летний трип",         note: "2 чел · 10 дней",         goalAmount: "150000", currentAmount: "62000", monthlyContribution: "15000", targetDate: d("2026-07-05"), currencyCode: "RUB", scope: Scope.SHARED },
      { id: FUND_IDS.ipad,    userId: DEFAULT_USER_ID, kind: FundKind.BUY,   name: "iPad Air · замена",            note: "11-дюймовый · 256ГБ",     goalAmount: "75000",  currentAmount: "68000", monthlyContribution: "8000",  targetDate: d("2026-05-22"), currencyCode: "RUB" },
      { id: FUND_IDS.vault,   userId: DEFAULT_USER_ID, kind: FundKind.VAULT, name: "Финансовая подушка · 3 мес",   note: "3 × средние расходы",    goalAmount: "450000", currentAmount: "98000", monthlyContribution: "10000", targetDate: null,            currencyCode: "RUB" },
      { id: FUND_IDS.gifts,   userId: DEFAULT_USER_ID, kind: FundKind.GIFT,  name: "Подарки · ДР и праздники",     note: "6 близких + партнёр",     goalAmount: "80000",  currentAmount: "34000", monthlyContribution: "6700",  targetDate: null,            currencyCode: "RUB" },
      { id: FUND_IDS.macbook, userId: DEFAULT_USER_ID, kind: FundKind.BUY,   name: "Апгрейд ноутбука",             note: "MacBook Pro 14 · M5",    goalAmount: "280000", currentAmount: "22500", monthlyContribution: "2300",  targetDate: d("2026-12-31"), currencyCode: "RUB" },
    ],
  });
}

async function seedPlannedEvents() {
  await db.plannedEvent.createMany({
    data: [
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.HOLIDAY,  name: "Годовщина с партнёром · 3 года", eventDate: d("2026-04-28"), fundId: FUND_IDS.gifts,   expectedAmount: "12000", currencyCode: "RUB", note: "обычно ресторан + подарок" },
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.OTHER,    name: "Декларация · самозанятость Q1",  eventDate: d("2026-04-30"),                                                                         note: "через «Мой налог» · до 25.05" },
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.BIRTHDAY, name: "ДР папы · 62",                   eventDate: d("2026-05-03"), repeatsYearly: true, fundId: FUND_IDS.gifts, expectedAmount: "8000",  currencyCode: "RUB" },
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.HOLIDAY,  name: "День Победы",                    eventDate: d("2026-05-09"), repeatsYearly: true },
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.BIRTHDAY, name: "ДР сестры · 28",                 eventDate: d("2026-05-15"), repeatsYearly: true, fundId: FUND_IDS.gifts, expectedAmount: "10000", currencyCode: "RUB" },
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.PURCHASE, name: "Замена планшета",                eventDate: d("2026-05-22"), fundId: FUND_IDS.ipad,    expectedAmount: "75000", currencyCode: "RUB" },
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.BIRTHDAY, name: "Твой ДР · 31",                   eventDate: d("2026-06-11"), repeatsYearly: true, fundId: FUND_IDS.gifts, expectedAmount: "15000", currencyCode: "RUB" },
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.HOLIDAY,  name: "День России",                    eventDate: d("2026-06-12"), repeatsYearly: true },
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.TRIP,     name: "Трип · Грузия · 10 дней",         eventDate: d("2026-07-05"), fundId: FUND_IDS.georgia, expectedAmount: "150000", currencyCode: "RUB" },
      { userId: DEFAULT_USER_ID, kind: PlannedEventKind.BIRTHDAY, name: "ДР мамы · 58",                   eventDate: d("2026-07-28"), repeatsYearly: true, fundId: FUND_IDS.gifts, expectedAmount: "10000", currencyCode: "RUB" },
    ],
  });
}

// ────────────────────────────────────────────────────────────────
// 11. Family + members (mock-family)
// ────────────────────────────────────────────────────────────────
const FAMILY_ID = "fam_nikitiny";
const FAMILY_MEMBER_IDS = {
  w: "fm_w",
  m: "fm_m",
  s: "fm_s",
};

async function seedFamily() {
  await db.family.create({
    data: {
      id: FAMILY_ID,
      name: "Никитины · семья",
      note: "квартира · общие подписки · общие накопления",
      ownerId: DEFAULT_USER_ID,
      createdAt: d("2024-02-02"),
      members: {
        create: [
          { id: FAMILY_MEMBER_IDS.w, userId: DEFAULT_USER_ID, displayName: "Владимир", letter: "W", color: "var(--accent)", role: FamilyRole.OWNER,  joinedAt: d("2024-02-02") },
          { id: FAMILY_MEMBER_IDS.m, userId: null,             displayName: "Маша",     letter: "M", color: "var(--info)",   role: FamilyRole.MEMBER, joinedAt: d("2024-02-05") },
          { id: FAMILY_MEMBER_IDS.s, userId: null,             displayName: "Лена",     letter: "S", color: "var(--warn)",   role: FamilyRole.MEMBER, joinedAt: d("2026-03-18") },
        ],
      },
    },
  });

  // Fund'ы на семейный scope линкуем
  await db.fund.update({ where: { id: FUND_IDS.georgia }, data: { familyId: FAMILY_ID } });
}

// ────────────────────────────────────────────────────────────────
// 12. Subscriptions (после Family, чтобы линковать shares)
// ────────────────────────────────────────────────────────────────
async function seedSubscriptions() {
  await db.subscription.create({
    data: {
      id: SUB_IDS.netflix, userId: DEFAULT_USER_ID, name: "Netflix · Стандарт", icon: "N", iconColor: "#F85149", iconBg: "rgba(248,81,73,.12)",
      price: "499", currencyCode: "RUB", billingIntervalMonths: 1, nextPaymentDate: d("2026-05-15"),
      sharingType: SharingType.SPLIT, totalUsers: 3, familyId: FAMILY_ID,
      shares: { create: [
        { person: "Владимир", familyMemberId: FAMILY_MEMBER_IDS.w },
        { person: "Маша",     familyMemberId: FAMILY_MEMBER_IDS.m },
        { person: "Лена",     familyMemberId: FAMILY_MEMBER_IDS.s },
      ] },
    },
  });
  await db.subscription.create({
    data: {
      id: SUB_IDS.spotify, userId: DEFAULT_USER_ID, name: "Spotify · Премиум", icon: "S", iconColor: "#3FB950", iconBg: "rgba(63,185,80,.12)",
      price: "299", currencyCode: "RUB", billingIntervalMonths: 1, nextPaymentDate: d("2026-05-02"),
      sharingType: SharingType.PERSONAL,
    },
  });
  await db.subscription.create({
    data: {
      id: SUB_IDS.icloud, userId: DEFAULT_USER_ID, name: "iCloud 2ТБ · семья", icon: "i", iconColor: "#79C0FF", iconBg: "rgba(121,192,255,.12)",
      price: "650", currencyCode: "RUB", billingIntervalMonths: 1, nextPaymentDate: d("2026-05-08"),
      sharingType: SharingType.PAID_FOR_OTHERS, totalUsers: 5, familyId: FAMILY_ID,
      shares: { create: [
        { person: "Маша",  familyMemberId: FAMILY_MEMBER_IDS.m },
        { person: "Лена",  familyMemberId: FAMILY_MEMBER_IDS.s },
        { person: "Родители" },
        { person: "Партнёр" },
      ] },
    },
  });
  await db.subscription.create({
    data: {
      id: SUB_IDS.yandex, userId: DEFAULT_USER_ID, name: "Яндекс Плюс", icon: "Y", iconColor: "#D29922", iconBg: "rgba(210,153,34,.12)",
      price: "2990", currencyCode: "RUB", billingIntervalMonths: 12, nextPaymentDate: d("2027-02-14"),
      sharingType: SharingType.PERSONAL,
    },
  });
  await db.subscription.create({
    data: {
      id: SUB_IDS.figma, userId: DEFAULT_USER_ID, name: "Figma Pro", icon: "F", iconColor: "#58D3A3", iconBg: "rgba(88,211,163,.12)",
      price: "15", currencyCode: "USD", billingIntervalMonths: 1, nextPaymentDate: d("2026-05-18"),
      sharingType: SharingType.SPLIT, totalUsers: 2, familyId: FAMILY_ID,
      shares: { create: [
        { person: "Владимир", familyMemberId: FAMILY_MEMBER_IDS.w },
        { person: "Маша",     familyMemberId: FAMILY_MEMBER_IDS.m },
      ] },
    },
  });
  await db.subscription.create({
    data: {
      id: SUB_IDS.nyt, userId: DEFAULT_USER_ID, name: "NY Times · цифровая", icon: "N", iconColor: "#7D8898", iconBg: "rgba(125,136,152,.15)",
      price: "4", currencyCode: "USD", billingIntervalMonths: 1, nextPaymentDate: d("2026-05-22"),
      sharingType: SharingType.PERSONAL,
    },
  });
  await db.subscription.create({
    data: {
      id: SUB_IDS.adobe, userId: DEFAULT_USER_ID, name: "Adobe CC · Фото", icon: "A", iconColor: "#79C0FF", iconBg: "rgba(121,192,255,.12)",
      price: "10", currencyCode: "USD", billingIntervalMonths: 1, nextPaymentDate: d("2026-05-05"),
      sharingType: SharingType.PERSONAL,
    },
  });
  await db.subscription.create({
    data: {
      id: SUB_IDS.gym, userId: DEFAULT_USER_ID, name: "Зал · партнёр", icon: "G", iconColor: "#D29922", iconBg: "rgba(210,153,34,.12)",
      price: "2500", currencyCode: "RUB", billingIntervalMonths: 1, nextPaymentDate: d("2026-05-01"),
      sharingType: SharingType.PAID_FOR_OTHERS, totalUsers: 1, familyId: FAMILY_ID,
      shares: { create: [
        { person: "Маша", familyMemberId: FAMILY_MEMBER_IDS.m },
      ] },
    },
  });
}

// ────────────────────────────────────────────────────────────────
// 13. Transactions + transfers + reimbursements (mock-transactions)
// ────────────────────────────────────────────────────────────────
async function seedTransactions() {
  // 21.04 (пн · сегодня)
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.products,
    kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE,
    amount: "1860", currencyCode: "RUB", occurredAt: d("2026-04-21T11:42:00Z"),
    name: "Пятёрочка · продукты", note: "Тинькофф · карта ···4218",
  } });
  const taxiTx = await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.sberSalary, categoryId: CATEGORY_IDS.transport,
    kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE,
    amount: "3000", currencyCode: "RUB", occurredAt: d("2026-04-21T09:14:00Z"),
    name: "Яндекс Такси", note: "Сбер",
    isReimbursable: true, reimbursementFromName: "Acme", expectedReimbursement: "3000",
  } });
  void taxiTx;

  // 20.04 (вс)
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.cafe,
    kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE,
    amount: "1480", currencyCode: "RUB", occurredAt: d("2026-04-20T20:05:00Z"),
    name: "Додо Пицца", note: "Тинькофф",
  } });
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.sberSalary, categoryId: CATEGORY_IDS.clothes,
    kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE,
    amount: "4980", currencyCode: "RUB", occurredAt: d("2026-04-20T15:30:00Z"),
    name: "Uniqlo · футболка + носки",
  } });
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.products,
    kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE,
    amount: "2970", currencyCode: "RUB", occurredAt: d("2026-04-20T11:00:00Z"),
    name: "ВкусВилл · продукты",
  } });
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.cashback,
    kind: TransactionKind.INCOME, status: TransactionStatus.DONE,
    amount: "1500", currencyCode: "RUB", occurredAt: d("2026-04-20T10:12:00Z"),
    name: "Кэшбэк · Тинькофф", note: "авто-запись",
  } });

  // 18.04 (пт) — зарплата + перевод
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.freelance,
    kind: TransactionKind.INCOME, status: TransactionStatus.DONE, workSourceId: WORK_IDS.hatch,
    amount: "45000", currencyCode: "RUB", occurredAt: d("2026-04-18T18:02:00Z"),
    name: "Фриланс · Acme Design Sprint", note: "налог 6% = ₽ 2 700",
  } });

  // Transfer t8: Тинькофф → Сбер (копилка), 20 000 ₽ 1:1
  const transfer = await db.transfer.create({ data: {
    userId: DEFAULT_USER_ID,
    fromAccountId: ACCOUNT_IDS.tinkCard, toAccountId: ACCOUNT_IDS.sberSavings,
    fromAmount: "20000", toAmount: "20000",
    fromCcy: "RUB", toCcy: "RUB", rate: "1.0000000000",
    occurredAt: d("2026-04-18T16:40:00Z"), note: "курс 1:1 · без комиссии",
  } });
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.transfers,
    kind: TransactionKind.TRANSFER, status: TransactionStatus.DONE, transferId: transfer.id,
    amount: "20000", currencyCode: "RUB", occurredAt: d("2026-04-18T16:40:00Z"),
    name: "Перевод · Тинькофф → Сбер (копилка)",
  } });
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.sberSavings, categoryId: CATEGORY_IDS.transfers,
    kind: TransactionKind.TRANSFER, status: TransactionStatus.DONE, transferId: transfer.id,
    amount: "20000", currencyCode: "RUB", occurredAt: d("2026-04-18T16:40:00Z"),
    name: "Перевод · Тинькофф → Сбер (копилка)",
  } });

  await db.transaction.createMany({ data: [
    { userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.cafe,       kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE, amount: "1320", currencyCode: "RUB", occurredAt: d("2026-04-18T13:22:00Z"), name: "Бургер Кинг · ужин" },
    { userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.sberSalary, categoryId: CATEGORY_IDS.transport, kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE, amount: "3000", currencyCode: "RUB", occurredAt: d("2026-04-18T11:15:00Z"), name: "Метро · Тройка пополнение" },
    { userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.sberSalary, categoryId: CATEGORY_IDS.health,    kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE, amount: "480",  currencyCode: "RUB", occurredAt: d("2026-04-18T09:44:00Z"), name: "Аптека · лекарства" },
  ] });

  // 15.04 (вт) — plan/partial
  await db.transaction.createMany({ data: [
    { userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.sberSalary, categoryId: CATEGORY_IDS.health, kind: TransactionKind.EXPENSE, status: TransactionStatus.PLANNED, amount: "4500",  currencyCode: "RUB", occurredAt: d("2026-04-15T20:00:00Z"), plannedAt: d("2026-04-15T20:00:00Z"), name: "Зал · абонемент", note: "Сбер · регулярно" },
  ] });
  const partial = await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.freelance,
    kind: TransactionKind.INCOME, status: TransactionStatus.PARTIAL, workSourceId: WORK_IDS.hatch,
    amount: "30000", currencyCode: "RUB", occurredAt: d("2026-04-15T14:00:00Z"),
    name: "Hatch · онбординг этап 2/3", note: "ожид. ₽ 30 000 · получ. ₽ 12 000",
  } });
  await db.transactionFact.create({ data: {
    transactionId: partial.id, amount: "12000", occurredAt: d("2026-04-15T14:00:00Z"),
    note: "первый транш",
  } });
  await db.transaction.createMany({ data: [
    { userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.products, kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE, amount: "3420", currencyCode: "RUB", occurredAt: d("2026-04-15T12:10:00Z"), name: "Лента · продукты" },
    { userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.subs,     kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE, amount: "499",  currencyCode: "RUB", occurredAt: d("2026-04-15T09:00:00Z"), name: "Netflix · стандарт", subscriptionId: SUB_IDS.netflix },
  ] });

  // 12.04 (сб) — личный долг выдал + cancel
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.cashWallet, categoryId: CATEGORY_IDS.debt,
    kind: TransactionKind.DEBT_OUT, status: TransactionStatus.DONE, personalDebtId: DEBT_IDS.sasha,
    amount: "25000", currencyCode: "RUB", occurredAt: d("2026-04-12T18:00:00Z"),
    name: "Выдача · Саша (залог за квартиру)", note: "вернёт до 30.05",
  } });
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.cafe,
    kind: TransactionKind.EXPENSE, status: TransactionStatus.DONE,
    amount: "2840", currencyCode: "RUB", occurredAt: d("2026-04-12T14:30:00Z"),
    name: "Кофемания · бранч с М.",
  } });
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.electronics,
    kind: TransactionKind.EXPENSE, status: TransactionStatus.CANCELLED,
    amount: "8900", currencyCode: "RUB", occurredAt: d("2026-04-12T00:00:00Z"),
    name: "Ozon · наушники", note: "заказ отменён · возврат в ожидании",
  } });

  // 10.04 (чт · зп) — зарплата + платёж по ипотеке
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.tinkCard, categoryId: CATEGORY_IDS.salary,
    kind: TransactionKind.INCOME, status: TransactionStatus.DONE, workSourceId: WORK_IDS.acme,
    amount: "120000", currencyCode: "RUB", occurredAt: d("2026-04-10T10:00:00Z"),
    name: "Зарплата · Acme — апр", note: "50/30/20: нужды 60к · хотелки 36к · накоп. 24к",
  } });
  const loanPayment = await db.loanPayment.findFirst({ where: { loanId: LOAN_MORTGAGE, paidAt: d("2026-04-10") } });
  await db.transaction.create({ data: {
    userId: DEFAULT_USER_ID, accountId: ACCOUNT_IDS.sberMortgage, categoryId: CATEGORY_IDS.loans,
    kind: TransactionKind.LOAN_PAYMENT, status: TransactionStatus.DONE,
    loanId: LOAN_MORTGAGE, loanPaymentId: loanPayment?.id ?? null,
    amount: "57400", currencyCode: "RUB", occurredAt: d("2026-04-10T10:15:00Z"),
    name: "Ипотека · Сбер — апр", note: "тело 38 140 + %% 19 260",
  } });
}

// ────────────────────────────────────────────────────────────────
// RUN
// ────────────────────────────────────────────────────────────────
async function main() {
  console.log("→ currencies");
  await seedCurrencies();

  console.log("→ wipe user");
  await wipeUser();

  console.log("→ user + budget settings");
  await seedUser();

  console.log("→ institutions + accounts");
  await seedAccounts();

  console.log("→ categories");
  await seedCategories();

  console.log("→ work sources");
  await seedWorkSources();

  console.log("→ loans + payments");
  await seedLoans();

  console.log("→ personal debts");
  await seedPersonalDebts();

  console.log("→ long projects");
  await seedLongProjects();

  console.log("→ funds");
  await seedFunds();

  console.log("→ planned events");
  await seedPlannedEvents();

  console.log("→ family + members");
  await seedFamily();

  console.log("→ subscriptions + shares");
  await seedSubscriptions();

  console.log("→ transactions + transfers + facts");
  await seedTransactions();

  console.log("✓ seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
