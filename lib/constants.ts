export const DEFAULT_USER_ID = "usr_default_single";

// ── Onboarding cookie ────────────────────────────────────────────────────────
// Single source of truth — used by middleware.ts, actions.ts, and the
// /api/onboarding/heal route handler. Never duplicate these values.
export const ONBOARDED_COOKIE_NAME = "bdg:onboarded";
export const ONBOARDED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
export const ONBOARDED_COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: ONBOARDED_COOKIE_MAX_AGE,
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
} as const;

// Количество рабочих часов в месяц по умолчанию (используется в hours-calc при отсутствии override'а WorkSource.hoursPerMonth).
export const HOURS_PER_MONTH_DEFAULT = 160;
export const DEFAULT_USER_EMAIL = "dcfrqb@gmail.com";
export const DEFAULT_USER_NAME = "Владимир";

export const DEFAULT_CURRENCY = "RUB";

export const SUPPORTED_CURRENCIES = [
  { code: "RUB", name: "Российский рубль", symbol: "₽", decimals: 2 },
  { code: "USD", name: "Доллар США", symbol: "$", decimals: 2 },
  { code: "EUR", name: "Евро", symbol: "€", decimals: 2 },
  { code: "GEL", name: "Грузинский лари", symbol: "₾", decimals: 2 },
  { code: "USDT", name: "Tether", symbol: "₮", decimals: 2 },
  { code: "BTC", name: "Bitcoin", symbol: "₿", decimals: 8 },
] as const;
