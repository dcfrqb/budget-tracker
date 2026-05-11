import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlannedEvents } from "@/lib/data/planned-events";
import { getSubscriptions } from "@/lib/data/subscriptions";
import { getLoans } from "@/lib/data/loans";
import { getFundsWithProgress } from "@/lib/data/funds";
import { computeAmortization } from "@/lib/amortization";

export type TimelineItemKind =
  | "event"
  | "subscription"
  | "loan"
  | "fund_target"
  | "txn_planned";

export type TimelineItem = {
  id: string;
  kind: TimelineItemKind;
  subKind?: string;
  date: Date;
  label: string;
  amount: Prisma.Decimal | null;
  currencyCode: string | null;
  href: string;
  glyph: string;
};

const EVENT_GLYPH: Record<string, string> = {
  BIRTHDAY: "B",
  HOLIDAY: "H",
  TRIP: "T",
  PURCHASE: "P",
  OTHER: "O",
};

export async function getPlanningTimeline(
  userId: string,
  opts: { from: Date; to: Date },
): Promise<TimelineItem[]> {
  const { from, to } = opts;

  const [events, subscriptions, loans, funds, plannedTxns] = await Promise.all([
    getPlannedEvents(userId, { from, to }),
    getSubscriptions(userId),
    getLoans(userId),
    getFundsWithProgress(userId),
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        status: "PLANNED",
        occurredAt: { gte: from, lte: to },
      },
      orderBy: { occurredAt: "asc" },
    }),
  ]);

  const items: TimelineItem[] = [];

  // ── Events ───────────────────────────────────────────────────
  for (const evt of events) {
    items.push({
      id: `event:${evt.id}:${evt.eventDate.toISOString().slice(0, 10)}`,
      kind: "event",
      subKind: evt.kind,
      date: evt.eventDate,
      label: evt.name,
      amount: evt.expectedAmount ? new Prisma.Decimal(evt.expectedAmount) : null,
      currencyCode: evt.currencyCode ?? null,
      href: `/planning/events`,
      glyph: EVENT_GLYPH[evt.kind] ?? "O",
    });
  }

  // ── Subscriptions (single occurrence in window) ──────────────
  for (const sub of subscriptions) {
    const d = sub.nextPaymentDate;
    if (d >= from && d <= to) {
      items.push({
        id: `subscription:${sub.id}:${d.toISOString().slice(0, 10)}`,
        kind: "subscription",
        date: d,
        label: sub.name,
        amount: new Prisma.Decimal(sub.price),
        currencyCode: sub.currencyCode,
        href: `/expenses/subscriptions`,
        glyph: "S",
      });
    }
  }

  // ── Loans (amortization rows in window) ──────────────────────
  for (const loan of loans) {
    const schedule = computeAmortization({
      principal: new Prisma.Decimal(loan.principal),
      annualRatePct: new Prisma.Decimal(loan.annualRatePct),
      termMonths: loan.termMonths,
      startDate: loan.startDate,
    });
    const paymentsMade = loan.payments.length;
    for (const row of schedule) {
      if (row.n <= paymentsMade) continue;
      if (row.date < from) continue;
      if (row.date > to) break;
      items.push({
        id: `loan:${loan.id}:${row.date.toISOString().slice(0, 10)}`,
        kind: "loan",
        date: row.date,
        label: loan.name,
        amount: row.payment,
        currencyCode: loan.currencyCode,
        href: `/expenses/loans/${loan.id}`,
        glyph: "L",
      });
    }
  }

  // ── Fund targets in window ───────────────────────────────────
  for (const fund of funds) {
    if (!fund.targetDate) continue;
    const d = fund.targetDate;
    if (d >= from && d <= to) {
      items.push({
        id: `fund_target:${fund.id}:${d.toISOString().slice(0, 10)}`,
        kind: "fund_target",
        date: d,
        label: fund.name,
        amount: new Prisma.Decimal(fund.goalAmount),
        currencyCode: fund.currencyCode,
        href: `/planning/funds/${fund.id}`,
        glyph: "F",
      });
    }
  }

  // ── Planned transactions ─────────────────────────────────────
  for (const txn of plannedTxns) {
    items.push({
      id: `txn_planned:${txn.id}:${txn.occurredAt.toISOString().slice(0, 10)}`,
      kind: "txn_planned",
      date: txn.occurredAt,
      label: txn.name,
      amount: new Prisma.Decimal(txn.amount),
      currencyCode: txn.currencyCode,
      href: `/transactions`,
      glyph: "P",
    });
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
