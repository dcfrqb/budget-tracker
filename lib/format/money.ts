import { Prisma } from "@prisma/client";

type CurrencyShape = { code: string; symbol: string; decimals: number };

function toDecimal(v: Prisma.Decimal | string | number): Prisma.Decimal {
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
}

// Форматирует число с русской группировкой (узкий non-breaking space как thousand-sep).
// Количество знаков после запятой определяется аргументом fractionDigits;
// если undefined — убираются незначащие нули (обычно для BTC).
function formatNumber(amount: Prisma.Decimal, fractionDigits?: number): string {
  if (fractionDigits === undefined) {
    const str = amount.toString();
    const [intPart, decPart] = str.split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return decPart ? `${grouped}.${decPart}` : grouped;
  }
  const fixed = amount.toFixed(fractionDigits);
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart ? `${grouped}.${decPart}` : grouped;
}

// Отображение суммы со знаком валюты ПОСЛЕ: "142 680 ₽", "2 145 $", "0.00097 ₿".
// Для RUB/USD/EUR/GEL/USDT — без дробной части если .00; для BTC — как есть.
export function formatAmount(
  value: Prisma.Decimal | string | number,
  currency: CurrencyShape,
): string {
  const amount = toDecimal(value);
  const fd =
    currency.code === "BTC"
      ? undefined                                         // "0.00097"
      : amount.modulo(1).isZero()
        ? 0                                               // целое → без .00
        : Math.min(currency.decimals, 2);                 // "142 680.50"
  const formatted = formatNumber(amount, fd);
  return `${formatted} ${currency.symbol}`;
}

// Отображение RUB-суммы с префиксом: "₽ 484 620".
export function formatRubPrefix(value: Prisma.Decimal | string | number): string {
  const amount = toDecimal(value);
  const fd = amount.modulo(1).isZero() ? 0 : 2;
  return `₽ ${formatNumber(amount, fd)}`;
}

// "92.10" для пары USD-RUB в rates-row (всегда 2 decimals).
export function formatRate(value: Prisma.Decimal | string | number): string {
  return formatNumber(toDecimal(value), 2);
}
