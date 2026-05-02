import Link from "next/link";
import type { ReactNode } from "react";
import type { SubscriptionSummaryView } from "@/lib/view/subscriptions";

type Props = {
  pageTitle: string;
  summary: SubscriptionSummaryView;
  addButton: string;
  importButton?: ReactNode;
};

export function SubscriptionsSummaryBar({ pageTitle, summary, addButton, importButton }: Props) {
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
        {importButton}
        <Link
          href="/expenses/subscriptions/new"
          className="btn primary"
          style={{ padding: "3px 9px", fontSize: 10, marginLeft: importButton ? 0 : 10 }}
        >
          {addButton}
        </Link>
      </div>
    </div>
  );
}
