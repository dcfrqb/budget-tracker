import { cache } from "react";
import { db } from "@/lib/db";
import { Prisma, TransactionKind, TransactionStatus, FreelanceOrderStageStatus } from "@prisma/client";

export const getFreelanceOrdersByWorkSource = cache(
  async (userId: string, workSourceId: string) => {
    return db.freelanceOrder.findMany({
      where: { userId, workSourceId },
      orderBy: [
        { performedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
    });
  },
);

export const getFreelanceOrderById = cache(
  async (userId: string, id: string) => {
    return db.freelanceOrder.findFirst({
      where: { id, userId },
    });
  },
);

export type FreelanceOrderPaymentRow = {
  id: string;
  occurredAt: Date;
  amount: Prisma.Decimal;
  name: string;
  accountId: string | null;
  currencyCode: string;
  status: TransactionStatus;
};

export type LinkedPaymentRow = {
  id: string;
  freelanceOrderId: string;
  occurredAt: Date;
  amount: Prisma.Decimal;
  name: string;
  currencyCode: string;
  status: TransactionStatus;
};

export async function getLinkedPaymentsByOrderIds(
  userId: string,
  orderIds: string[],
): Promise<LinkedPaymentRow[]> {
  if (orderIds.length === 0) return [];
  const rows = await db.transaction.findMany({
    where: {
      freelanceOrderId: { in: orderIds },
      userId,
      deletedAt: null,
      kind: TransactionKind.INCOME,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
    },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      freelanceOrderId: true,
      occurredAt: true,
      amount: true,
      name: true,
      currencyCode: true,
      status: true,
    },
  });
  return rows
    .filter((r) => r.freelanceOrderId !== null)
    .map((r) => ({ ...r, freelanceOrderId: r.freelanceOrderId!, amount: new Prisma.Decimal(r.amount) }));
}

export const getFreelanceOrderPayments = cache(
  async (userId: string, orderId: string): Promise<FreelanceOrderPaymentRow[]> => {
    const rows = await db.transaction.findMany({
      where: {
        freelanceOrderId: orderId,
        userId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        occurredAt: true,
        amount: true,
        name: true,
        accountId: true,
        currencyCode: true,
        status: true,
      },
    });
    return rows.map((r) => ({ ...r, amount: new Prisma.Decimal(r.amount) }));
  },
);

export type OrderPlanFact = {
  plan: Prisma.Decimal;
  received: Prisma.Decimal;
  remaining: Prisma.Decimal;
};

export function computeOrderPlanFact(
  order: { amount: Prisma.Decimal | string | number },
  stages: Array<{ status: FreelanceOrderStageStatus; paidAmount: Prisma.Decimal | string | number | null }>,
  linkedTxns: Array<{ amount: Prisma.Decimal | string | number }>,
): OrderPlanFact {
  const plan = new Prisma.Decimal(order.amount);
  let received: Prisma.Decimal;

  if (stages.length > 0) {
    received = stages
      .filter((s) => s.status === FreelanceOrderStageStatus.PAID && s.paidAmount != null)
      .reduce((sum, s) => sum.plus(new Prisma.Decimal(s.paidAmount!)), new Prisma.Decimal(0));
  } else {
    received = linkedTxns.reduce(
      (sum, t) => sum.plus(new Prisma.Decimal(t.amount)),
      new Prisma.Decimal(0),
    );
  }

  const remaining = plan.minus(received).lt(0) ? new Prisma.Decimal(0) : plan.minus(received);
  return { plan, received, remaining };
}

export const getFreelanceOrderDetail = cache(
  async (userId: string, orderId: string) => {
    const order = await db.freelanceOrder.findFirst({
      where: { id: orderId, userId },
      include: {
        stages: { orderBy: { sortOrder: "asc" } },
        workSource: { select: { id: true, name: true, kind: true, currencyCode: true } },
      },
    });
    if (!order) return null;

    const linkedTxns = await db.transaction.findMany({
      where: {
        freelanceOrderId: orderId,
        userId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        occurredAt: true,
        amount: true,
        name: true,
        accountId: true,
        currencyCode: true,
        status: true,
      },
    });

    return {
      order,
      linkedTxns: linkedTxns.map((t) => ({ ...t, amount: new Prisma.Decimal(t.amount) })),
    };
  },
);
