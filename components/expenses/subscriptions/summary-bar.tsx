import Link from "next/link";
import type { SubscriptionSummaryView } from "@/lib/view/subscriptions";

type Props = {
  pageTitle: string;
  summary: SubscriptionSummaryView;
  addButton: string;
};

export function SubscriptionsSummaryBar({ pageTitle, summary, addButton }: Props) {
  return (
    <div className="section-hd">
      <div className="ttl mono">
        <b>{pageTitle}</b>
        <span className="dim"> &middot; {summary.monthly} &middot; {summary.activeCount}</span>
      </div>
      <div className="meta mono" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "var(--muted)" }}>
          {summary.personalLabel} {summary.personalAmount}
        </span>
        <span style={{ color: "var(--dim)" }}>·</span>
        <span style={{ color: "var(--info)" }}>
          {summary.splitLabel} {summary.splitAmount}
        </span>
        <span style={{ color: "var(--dim)" }}>·</span>
        <span style={{ color: "var(--accent)" }}>
          {summary.paidForOthersLabel} {summary.paidForOthersAmount}
        </span>
        <Link
          href="/expenses/subscriptions/new"
          className="btn primary"
          style={{ padding: "3px 9px", fontSize: 10, marginLeft: 10 }}
        >
          {addButton}
        </Link>
      </div>
    </div>
  );
}
