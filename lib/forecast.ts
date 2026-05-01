import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Pure forecast functions — no I/O, no Prisma queries.
// ─────────────────────────────────────────────────────────────

export type ForecastInput = {
  totalBalanceBase: Prisma.Decimal;
  avgDailySpendBase: Prisma.Decimal;    // средние расходы за последние 30д в baseCcy
  upcomingInflow30dBase: Prisma.Decimal; // запланированные поступления в окне 30д
  upcomingOutflow30dBase: Prisma.Decimal; // запланированные списания в окне 30д
};

export type ForecastOutput = {
  safeUntilDays: number | null; // null если avgDailySpend <= 0
  reservedBase: Prisma.Decimal;
  freeBase: Prisma.Decimal;
};

/**
 * Сумма зарезервированных обязательств в окне 30д.
 */
export function computeReserved(args: {
  subscriptions30dBase: Prisma.Decimal;
  loanPayments30dBase: Prisma.Decimal;
  plannedOutflows30dBase: Prisma.Decimal;
  fundsContribTargets30dBase: Prisma.Decimal;
  creditCardPayments30dBase?: Prisma.Decimal;
}): Prisma.Decimal {
  return args.subscriptions30dBase
    .plus(args.loanPayments30dBase)
    .plus(args.plannedOutflows30dBase)
    .plus(args.fundsContribTargets30dBase)
    .plus(args.creditCardPayments30dBase ?? new Prisma.Decimal(0));
}

/**
 * Свободный остаток = max(0, total - reserved).
 */
export function computeFreeAmount(
  total: Prisma.Decimal,
  reserved: Prisma.Decimal,
): Prisma.Decimal {
  const free = total.minus(reserved);
  return free.isNegative() ? new Prisma.Decimal(0) : free;
}

/**
 * Сколько дней хватит баланса при текущем темпе расходов.
 * Формула: (totalBalance + upcomingInflow30d - upcomingOutflow30d) / avgDailySpend
 * Возвращает null если avgDailySpend <= 0 (нет расходов — бесконечно).
 */
export function computeSafeUntil(input: ForecastInput): number | null {
  if (input.avgDailySpendBase.lte(0)) return null;

  const effective = input.totalBalanceBase
    .plus(input.upcomingInflow30dBase)
    .minus(input.upcomingOutflow30dBase);

  if (effective.lte(0)) return 0;

  return effective.div(input.avgDailySpendBase).floor().toNumber();
}
