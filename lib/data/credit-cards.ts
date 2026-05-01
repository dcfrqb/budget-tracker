import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type CreditCardObligationView = {
  id: string;
  name: string;
  last4: string | null;
  currency: string;
  debtBalance: number;
  creditLimit: number | null;
  minPayment: number;
  paymentDueDay: number | null;
  nextDueDate: Date | null;
  daysUntilDue: number | null;
};

export async function getCreditCardObligations(userId: string): Promise<CreditCardObligationView[]> {
  const now = new Date();

  const cards = await db.account.findMany({
    where: {
      userId,
      kind: "CREDIT",
      deletedAt: null,
      OR: [
        { minPaymentFixed: { not: null } },
        { minPaymentPercent: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      cardLast4: true,
      currencyCode: true,
      balance: true,
      debtBalance: true,
      creditLimit: true,
      minPaymentFixed: true,
      minPaymentPercent: true,
      paymentDueDay: true,
      statementDay: true,
    },
  });

  const views: CreditCardObligationView[] = [];

  for (const card of cards) {
    const fixed = card.minPaymentFixed ? new Prisma.Decimal(card.minPaymentFixed) : null;
    const debt = card.debtBalance ? new Prisma.Decimal(card.debtBalance) : new Prisma.Decimal(0);
    const pctAmount = card.minPaymentPercent ? debt.mul(card.minPaymentPercent).div(100) : null;

    let effectiveAmount: Prisma.Decimal | null = null;
    if (fixed !== null && pctAmount !== null) {
      effectiveAmount = fixed.greaterThan(pctAmount) ? fixed : pctAmount;
    } else if (fixed !== null) {
      effectiveAmount = fixed;
    } else if (pctAmount !== null) {
      effectiveAmount = pctAmount;
    }
    if (!effectiveAmount || effectiveAmount.lte(0)) continue;

    let nextDueDate: Date | null = null;
    if (card.paymentDueDay) {
      const day = card.paymentDueDay;
      const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
      nextDueDate = candidate >= now ? candidate : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day));
    } else if (card.statementDay) {
      const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), card.statementDay + 20));
      nextDueDate = candidate >= now ? candidate : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, card.statementDay + 20));
    }

    const daysUntilDue = nextDueDate
      ? Math.ceil((nextDueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    const creditLimit = card.creditLimit ? Number(new Prisma.Decimal(card.creditLimit).toFixed(2)) : null;

    views.push({
      id: card.id,
      name: card.name,
      last4: card.cardLast4.length > 0 ? card.cardLast4[card.cardLast4.length - 1] : null,
      currency: card.currencyCode,
      debtBalance: Number(debt.toFixed(2)),
      creditLimit,
      minPayment: Number(effectiveAmount.toFixed(2)),
      paymentDueDay: card.paymentDueDay,
      nextDueDate,
      daysUntilDue,
    });
  }

  views.sort((a, b) => {
    if (a.daysUntilDue === null && b.daysUntilDue === null) return 0;
    if (a.daysUntilDue === null) return 1;
    if (b.daysUntilDue === null) return -1;
    return a.daysUntilDue - b.daysUntilDue;
  });

  return views;
}
