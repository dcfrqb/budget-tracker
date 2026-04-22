import { Prisma } from "@prisma/client";

type CurrencyShape = { code: string; symbol: string; decimals: number };

function toDecimal(v: Prisma.Decimal | string | number): Prisma.Decimal {
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
}

// Группировка целой части + склейка с дробью. stripTrailingZeros убирает
// хвостовые нули из дробной части ("0.00097000" → "0.00097").
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
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart ? `${grouped}.${decPart}` : grouped;
}

// Отображение суммы со знаком валюты ПОСЛЕ: "142 680 ₽", "2 145 $", "0.00097 ₿".
// Если amount целый — без дробной части. Иначе — currency.decimals знаков,
// с отсечкой хвостовых нулей для крипто-точности (decimals > 2).
export function formatAmount(
  value: Prisma.Decimal | string | number,
  currency: CurrencyShape,
): string {
  const amount = toDecimal(value);
  const isInt = amount.modulo(1).isZero();
  const fd = isInt ? 0 : currency.decimals;
  const stripTrailing = currency.decimals > 2;
  const formatted = formatNumber(amount, fd, stripTrailing);
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
