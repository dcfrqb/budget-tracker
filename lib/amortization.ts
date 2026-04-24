import { Prisma } from "@prisma/client";

export type AmortizationRow = {
  n: number;
  date: Date;
  payment: Prisma.Decimal;
  principalPart: Prisma.Decimal;
  interestPart: Prisma.Decimal;
  balanceLeft: Prisma.Decimal;
};

export type AmortizationInput = {
  principal: Prisma.Decimal;
  annualRatePct: Prisma.Decimal;
  termMonths: number;
  startDate: Date;
};

// Аннуитетный график платежей.
// M = P * r / (1 - (1+r)^-n), где r = annualRatePct/100/12.
// Последний платёж корректируется под остаток для избежания накопленного округления.
export function computeAmortization(input: AmortizationInput): AmortizationRow[] {
  const { principal, annualRatePct, termMonths, startDate } = input;
  const ONE = new Prisma.Decimal(1);

  const monthlyRate = annualRatePct.div(100).div(12);

  // Если ставка 0 — равные платежи без процентов
  let monthlyPayment: Prisma.Decimal;
  if (monthlyRate.isZero()) {
    monthlyPayment = principal.div(termMonths);
  } else {
    // M = P * r / (1 - (1+r)^-n)
    const onePlusR = ONE.plus(monthlyRate);
    // (1+r)^-n = 1 / (1+r)^n
    const factor = ONE.div(Prisma.Decimal.pow(onePlusR, termMonths));
    monthlyPayment = principal.times(monthlyRate).div(ONE.minus(factor));
  }

  const rows: AmortizationRow[] = [];
  let balance = principal;

  for (let n = 1; n <= termMonths; n++) {
    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + n);

    const interestPart = balance.times(monthlyRate);
    let principalPart = monthlyPayment.minus(interestPart);

    // Последний платёж: гасим остаток
    if (n === termMonths) {
      principalPart = balance;
    }

    // Убеждаемся что principal не уходит в минус из-за округления
    if (principalPart.gt(balance)) {
      principalPart = balance;
    }

    const payment = principalPart.plus(interestPart);
    balance = balance.minus(principalPart);

    rows.push({
      n,
      date: paymentDate,
      payment,
      principalPart,
      interestPart,
      balanceLeft: balance,
    });
  }

  return rows;
}
