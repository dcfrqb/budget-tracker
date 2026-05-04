import { Prisma } from "@prisma/client";
import type { Locale } from "@/lib/i18n/types";

// Currencies that place the symbol BEFORE the amount (e.g. $ 1 599, € 1 599).
const PREFIX_CURRENCIES = new Set(["USD", "EUR"]);

const CURRENCY_DECIMALS: Record<string, number> = {
  RUB: 2, USD: 2, EUR: 2, GEL: 2,
  USDT: 6, USDC: 6, BTC: 8,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽", USD: "$", EUR: "€", GEL: "₾",
  USDT: "₮", USDC: "USDC", BTC: "₿",
};

export type FormatMoneyOptions = {
  approx?: boolean;
  signDisplay?: "auto" | "always" | "never";
  decimals?: number;
};

/**
 * Canonical money formatter.
 *
 * Rules:
 *   RUB         → symbol after, NBSP  — `1 599 ₽`
 *   USD / EUR   → symbol before, NBSP — `$ 1 599`, `€ 1 599`
 *   Other       → symbol after, NBSP  — `265.40 USDT`, `0.00097 ₿`
 *
 * Negative sign comes first in the full string:  `-$ 20.40`, `-1 599 ₽`.
 * Thousands separator: NBSP. Decimal separator: dot.
 * Approximation prefix (`≈ `) prepended when options.approx is true.
 */
export function formatMoney(
  value: Prisma.Decimal | string | number,
  currency: string,
  options: FormatMoneyOptions = {},
): string {
  const amount = toDecimal(value);
  const { approx = false, signDisplay = "auto", decimals } = options;

  const isNeg = amount.isNegative();
  const abs = isNeg ? amount.abs() : amount;

  const currencyDec = CURRENCY_DECIMALS[currency] ?? 2;

  let fd: number;
  if (decimals !== undefined) {
    fd = decimals;
  } else {
    const isInt = abs.modulo(1).isZero();
    fd = isInt ? 0 : currencyDec;
  }

  const stripTrailing = (decimals ?? currencyDec) > 2;
  const formatted = formatNumber(abs, fd, stripTrailing);

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const isPrefix = PREFIX_CURRENCIES.has(currency);

  // U+00A0 NBSP
  const nbsp = " ";
  const body = isPrefix
    ? `${symbol}${nbsp}${formatted}`
    : `${formatted}${nbsp}${symbol}`;

  let sign = "";
  if (signDisplay === "always") {
    sign = isNeg ? "-" : "+";
  } else if (signDisplay !== "never" && isNeg) {
    sign = "-";
  }

  const result = sign ? `${sign}${body}` : body;
  return approx ? `≈${nbsp}${result}` : result;
}

function toDecimal(v: Prisma.Decimal | string | number): Prisma.Decimal {
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
}

// Groups integer part + joins with fraction. stripTrailingZeros removes
// trailing zeros from fraction ("0.00097000" → "0.00097").
function formatNumber(
  amount: Prisma.Decimal,
  fractionDigits: number,
  stripTrailingZeros = false,
): string {
  const fixed = amount.toFixed(fractionDigits);
  let [intPart, decPart] = fixed.split(".");
  if (decPart && stripTrailingZeros) {
    decPart = decPart.replace(/0+$/, "");
  }
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart ? `${grouped}.${decPart}` : grouped;
}

/**
 * Formats a plain number with space-grouped thousands, no currency symbol.
 * The locale parameter is accepted for signature consistency but the
 * internal formatter always groups with spaces (universally readable).
 * Examples: 142680 → "142 680", 1234567 → "1 234 567"
 */
export function formatPlainNumber(
  value: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _locale?: Locale,
): string {
  return formatNumber(new Prisma.Decimal(Math.round(value)), 0);
}
