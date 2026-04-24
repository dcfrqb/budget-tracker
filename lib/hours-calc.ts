import { Prisma } from "@prisma/client";
import type { WorkSource } from "@prisma/client";
import { HOURS_PER_MONTH_DEFAULT } from "@/lib/constants";
import { convertToBase } from "@/lib/data/wallet";

export type HoursCalcInput = {
  amount: Prisma.Decimal;
  currencyCode: string;
  workSource: WorkSource;
  rates: Map<string, Prisma.Decimal>;
  baseCcy: string;
};

export type HoursCalcOutput = {
  hourlyGross: number;
  hourlyNet: number;
  grossHours: number;
  netHours: number;
  workWeeks: number;
  workMonths: number;
};

export function computeHoursForAmount(input: HoursCalcInput): HoursCalcOutput {
  const { amount, currencyCode, workSource, rates } = input;
  const hoursPerMonth = workSource.hoursPerMonth ?? HOURS_PER_MONTH_DEFAULT;
  const taxRate = workSource.taxRatePct
    ? new Prisma.Decimal(workSource.taxRatePct).div(100)
    : new Prisma.Decimal(0);

  // Вычисляем почасовую ставку (gross)
  let hourlyGross: Prisma.Decimal;

  if (workSource.kind === "FREELANCE") {
    if (!workSource.hourlyRate) {
      throw new Error("hourly_rate_required_for_freelance");
    }
    hourlyGross = new Prisma.Decimal(workSource.hourlyRate);
  } else if (workSource.kind === "EMPLOYMENT") {
    if (!workSource.baseAmount) {
      throw new Error("base_amount_required_for_employment");
    }
    hourlyGross = new Prisma.Decimal(workSource.baseAmount).div(hoursPerMonth);
  } else {
    // ONE_TIME: если есть baseAmount — как EMPLOYMENT, иначе как FREELANCE
    if (workSource.baseAmount) {
      hourlyGross = new Prisma.Decimal(workSource.baseAmount).div(hoursPerMonth);
    } else if (workSource.hourlyRate) {
      hourlyGross = new Prisma.Decimal(workSource.hourlyRate);
    } else {
      throw new Error("base_amount_or_hourly_rate_required");
    }
  }

  // hourlyNet = hourlyGross * (1 - taxRate)
  const hourlyNet = hourlyGross.times(new Prisma.Decimal(1).minus(taxRate));

  // Конвертируем amount в валюту workSource
  const amountInSourceCcy = (() => {
    if (currencyCode === workSource.currencyCode) return amount;
    // Конвертируем через rates: сначала amount → baseCcy → workSource.currencyCode
    const inBase = convertToBase(amount, currencyCode, input.baseCcy, rates);
    if (!inBase) return null;
    if (workSource.currencyCode === input.baseCcy) return inBase;
    const toSource = convertToBase(inBase, input.baseCcy, workSource.currencyCode, rates);
    return toSource;
  })();

  if (!amountInSourceCcy) {
    throw new Error("no_exchange_rate_available");
  }

  if (hourlyGross.isZero()) {
    throw new Error("hourly_rate_is_zero");
  }

  const grossHours = amountInSourceCcy.div(hourlyGross).toNumber();
  const netHours = hourlyNet.isZero()
    ? Infinity
    : amountInSourceCcy.div(hourlyNet).toNumber();
  const workWeeks = grossHours / 40;
  const workMonths = grossHours / hoursPerMonth;

  return {
    hourlyGross: hourlyGross.toNumber(),
    hourlyNet: hourlyNet.toNumber(),
    grossHours,
    netHours,
    workWeeks,
    workMonths,
  };
}
