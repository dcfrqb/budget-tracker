import { cache } from "react";
import { db } from "@/lib/db";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";

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
