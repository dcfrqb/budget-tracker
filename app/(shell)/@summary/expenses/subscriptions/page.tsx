export const dynamic = "force-dynamic";

import {
  SafeUntilBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUserId } from "@/lib/api/auth";
import { getSubscriptionsGrouped } from "@/lib/data/subscriptions";
import { toSubscriptionsSummaryView } from "@/lib/view/subscriptions";

export default async function SubscriptionsSummary() {
  const [userId, locale] = await Promise.all([getCurrentUserId(), getLocale()]);
  const [grouped] = await Promise.all([
    getSubscriptionsGrouped(userId),
  ]);

  const tFn = await getT(locale);
  const summary = toSubscriptionsSummaryView(grouped.totals, tFn);

  return (
    <SummaryShell>
      <SafeUntilBlock />
      <div className="sum-block">
        <div className="lbl">
          <span>{summary.monthly}</span>
          <span className="tiny mono">{summary.activeCount}</span>
        </div>
        <div className="sum-table">
          <div className="r">
            <span>{summary.personalLabel}</span>
            <span className="mono" style={{ color: "var(--text)" }}>{summary.personalAmount}</span>
          </div>
          <div className="r">
            <span>{summary.splitLabel}</span>
            <span className="mono" style={{ color: "var(--info)" }}>{summary.splitAmount}</span>
          </div>
          <div className="r">
            <span>{summary.paidForOthersLabel}</span>
            <span className="mono" style={{ color: "var(--accent)" }}>{summary.paidForOthersAmount}</span>
          </div>
        </div>
      </div>
    </SummaryShell>
  );
}
