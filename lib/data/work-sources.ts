import { cache } from "react";
import { db } from "@/lib/db";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";

export const getActiveWorkSources = cache(async (userId: string) => {
  return db.workSource.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
});

export const getWorkSourceById = cache(async (userId: string, id: string) => {
  return db.workSource.findFirst({
    where: { id, userId },
  });
});

// First active WorkSource by createdAt.
export const getPrimaryWorkSource = cache(async (userId: string) => {
  return db.workSource.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
});

export type WorkSourceCardSummary = {
  id: string;
  name: string;
  kind: string;
  currencyCode: string;
  rateType: string | null;
  rateAmount: Prisma.Decimal | null;
  payDay: number | null;
  taxRatePct: Prisma.Decimal | null;
  isActive: boolean;
  note: string | null;
  lastPaymentAt: Date | null;
  lastPaymentAmount: Prisma.Decimal | null;
  mtdTotal: Prisma.Decimal;
  nextExpectedAt: Date | null;
};

function startOfMonthUtcInTz(tz: string, now: Date = new Date()): Date {
  const ymFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit" });
  const ymParts = ymFmt.formatToParts(now);
  const year = Number(ymParts.find(p => p.type === "year")!.value);
  const month = Number(ymParts.find(p => p.type === "month")!.value);
  // Naive UTC midnight for that year/month
  const naive = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  // Determine what that naive UTC instant looks like in the target TZ
  const wallFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const wallParts = wallFmt.formatToParts(naive);
  const get = (t: string) => Number(wallParts.find(p => p.type === t)!.value);
  const asTzMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMs = asTzMs - naive.getTime();
  return new Date(naive.getTime() - offsetMs);
}

export const getWorkSourceCardSummaries = cache(async (userId: string): Promise<WorkSourceCardSummary[]> => {
  const tz = await getCurrentUserTz();

  const now = new Date();
  const mtdStart = startOfMonthUtcInTz(tz, now);

  const sources = await db.workSource.findMany({
    where: { userId },
    orderBy: [
      { isActive: "desc" },
      { createdAt: "asc" },
    ],
  });

  const results: WorkSourceCardSummary[] = await Promise.all(
    sources.map(async (ws) => {
      // Last payment (DONE or PARTIAL INCOME)
      const lastTxn = await db.transaction.findFirst({
        where: {
          userId,
          workSourceId: ws.id,
          deletedAt: null,
          kind: TransactionKind.INCOME,
          status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true, amount: true, status: true, facts: { select: { amount: true } } },
      });

      let lastPaymentAt: Date | null = null;
      let lastPaymentAmount: Prisma.Decimal | null = null;
      if (lastTxn) {
        lastPaymentAt = lastTxn.occurredAt;
        if (lastTxn.status === TransactionStatus.DONE) {
          lastPaymentAmount = new Prisma.Decimal(lastTxn.amount);
        } else {
          lastPaymentAmount = lastTxn.facts.reduce(
            (s, f) => s.plus(f.amount),
            new Prisma.Decimal(0),
          );
        }
      }

      // MTD total
      const mtdTxns = await db.transaction.findMany({
        where: {
          userId,
          workSourceId: ws.id,
          deletedAt: null,
          kind: TransactionKind.INCOME,
          status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
          occurredAt: { gte: mtdStart, lte: now },
        },
        select: { amount: true, status: true, facts: { select: { amount: true } } },
      });

      let mtdTotal = new Prisma.Decimal(0);
      for (const txn of mtdTxns) {
        if (txn.status === TransactionStatus.DONE) {
          mtdTotal = mtdTotal.plus(txn.amount);
        } else {
          mtdTotal = mtdTotal.plus(
            txn.facts.reduce((s, f) => s.plus(f.amount), new Prisma.Decimal(0)),
          );
        }
      }

      // Next expected
      const nextTxn = await db.transaction.findFirst({
        where: {
          userId,
          workSourceId: ws.id,
          deletedAt: null,
          kind: TransactionKind.INCOME,
          status: TransactionStatus.PLANNED,
          occurredAt: { gte: now },
        },
        orderBy: { occurredAt: "asc" },
        select: { occurredAt: true },
      });

      return {
        id: ws.id,
        name: ws.name,
        kind: ws.kind,
        currencyCode: ws.currencyCode,
        rateType: ws.rateType,
        rateAmount: ws.rateAmount,
        payDay: ws.payDay,
        taxRatePct: ws.taxRatePct,
        isActive: ws.isActive,
        note: ws.note,
        lastPaymentAt,
        lastPaymentAmount,
        mtdTotal,
        nextExpectedAt: nextTxn?.occurredAt ?? null,
      };
    }),
  );

  return results;
});
