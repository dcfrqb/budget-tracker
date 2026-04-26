import {
  AvailableBlock,
  BalancesBlock,
  QuickButtons,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { formatRubPrefix } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server";

export default async function TransactionsSummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [txns30d, rates] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        occurredAt: { gte: thirtyDaysAgo, lte: now },
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        kind: { in: [TransactionKind.INCOME, TransactionKind.EXPENSE] },
      },
      select: {
        kind: true,
        status: true,
        amount: true,
        currencyCode: true,
        facts: { select: { amount: true } },
        occurredAt: true,
      },
    }),
    getLatestRatesMap(),
  ]);

  let inflow = new Prisma.Decimal(0);
  let outflow = new Prisma.Decimal(0);

  for (const tx of txns30d) {
    const actual = tx.status === "DONE"
      ? new Prisma.Decimal(tx.amount)
      : tx.facts.reduce((s, f) => s.plus(f.amount), new Prisma.Decimal(0));
    const inBase = convertToBase(actual, tx.currencyCode, DEFAULT_CURRENCY, rates);
    if (!inBase) continue;
    if (tx.kind === TransactionKind.INCOME) inflow = inflow.plus(inBase);
    else outflow = outflow.plus(inBase);
  }

  const days = 30;
  const avgPerDay = outflow.div(days);

  const plannedCount = await db.transaction.count({
    where: {
      userId,
      deletedAt: null,
      status: TransactionStatus.PLANNED,
      occurredAt: { gte: now },
    },
  });

  return (
    <SummaryShell>
      <SafeUntilBlock />
      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.transactions.filter_label")}</span>
          <span className="tiny mono">{t("summary.transactions.filter_meta")}</span>
        </div>
        <div className="filt-summary">
          <div className="row"><span className="k">{t("summary.transactions.found_key")}</span><span className="v">{txns30d.length}</span></div>
          <div className="row"><span className="k">{t("summary.transactions.inflow_key")}</span><span className="v pos">{formatRubPrefix(inflow)}</span></div>
          <div className="row"><span className="k">{t("summary.transactions.outflow_key")}</span><span className="v info">{formatRubPrefix(outflow)}</span></div>
          <div className="row"><span className="k">{t("summary.transactions.avg_day_key")}</span><span className="v">{formatRubPrefix(avgPerDay)}</span></div>
        </div>
      </div>
      <AvailableBlock />
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: t("summary.transactions.mode_key"), v: t("summary.transactions.mode_val"), vClass: "pos" },
          { tone: "muted", k: t("summary.transactions.view_key"), v: t("summary.transactions.view_val") },
          {
            tone: plannedCount > 0 ? "warn" : "pos",
            k: t("summary.transactions.pending_key"),
            v: plannedCount > 0
              ? t("summary.transactions.pending_val", { vars: { count: String(plannedCount) } })
              : t("summary.transactions.pending_none"),
            vClass: plannedCount > 0 ? "warn" : "muted",
            vTitle: plannedCount > 0 ? t("summary.transactions.pending_tooltip") : undefined,
          },
        ]}
      />
      <QuickButtons />
    </SummaryShell>
  );
}
