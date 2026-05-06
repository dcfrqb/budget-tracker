export const dynamic = "force-dynamic";

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
import { getPeriodFlow } from "@/lib/data/_shared/period-aggregates";
import { db } from "@/lib/db";
import { TransactionKind, TransactionStatus } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server";

export default async function TransactionsSummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [flow, plannedCount] = await Promise.all([
    getPeriodFlow(userId, { from, to: now }, DEFAULT_CURRENCY),
    db.transaction.count({
      where: {
        userId,
        deletedAt: null,
        status: TransactionStatus.PLANNED,
        occurredAt: { gte: now },
        kind: { not: TransactionKind.TRANSFER },
        transferId: null,
      },
    }),
  ]);

  const avgPerDay = flow.outflowBase.div(30);

  return (
    <SummaryShell>
      <SafeUntilBlock />
      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.transactions.filter_label")}</span>
          <span className="tiny mono">{t("summary.transactions.filter_meta")}</span>
        </div>
        <div className="filt-summary">
          <div className="row"><span className="k">{t("summary.transactions.found_key")}</span><span className="v">{flow.txCount}</span></div>
          <div className="row"><span className="k">{t("summary.transactions.inflow_key")}</span><span className="v pos money">{formatMoney(flow.inflowBase, "RUB")}</span></div>
          <div className="row"><span className="k">{t("summary.transactions.outflow_key")}</span><span className="v info money">{formatMoney(flow.outflowBase, "RUB")}</span></div>
          <div className="row"><span className="k">{t("summary.transactions.avg_day_key")}</span><span className="v money">{formatMoney(avgPerDay, "RUB")}</span></div>
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
