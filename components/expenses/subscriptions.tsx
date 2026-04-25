import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export type SubSummaryItem = {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  name: string;
  badge: "personal" | "split" | "pays";
  badgeLabel: string;
  period: string;
  note: string;
  amount: string;
  share?: string;
  shareTone?: "muted" | "acc";
  next: string;
  nextTone: "warn" | "ok";
};

export type SubsMonthlyTotals = {
  personal: string;
  split: string;
  paidForOthers: string;
  total: string;
};

export async function Subscriptions({
  items,
  totals,
}: {
  items: SubSummaryItem[];
  totals?: SubsMonthlyTotals;
}) {
  const t = await getT();

  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("expenses.subscriptions.pageTitle")}</b>{" "}
          <span className="dim">· {items.length}</span>
        </div>
        <div className="meta mono" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {totals && (
            <>
              <span style={{ color: "var(--muted)" }}>
                {t("expenses.subscriptions.totals.personal_label")} {totals.personal}
              </span>
              {" · "}
              <span style={{ color: "var(--info)" }}>
                {t("expenses.subscriptions.totals.split_label")} {totals.split}
              </span>
              {" · "}
              <span style={{ color: "var(--accent)" }}>
                {t("expenses.subscriptions.totals.paid_for_others_label")} {totals.paidForOthers}
              </span>
              {" · "}
            </>
          )}
          <Link
            href="/expenses/subscriptions"
            className="btn"
            style={{ padding: "3px 9px", fontSize: 10 }}
          >
            {t("expenses.subscriptions.manage")} →
          </Link>
        </div>
      </div>
      <div className="section-body flush">
        <div className="sub-grid">
          {items.map((s) => (
            <article key={s.id} className="sub-card" tabIndex={0}>
              <div className="sub-top">
                <div className="sub-ico" style={{ background: s.iconBg, color: s.iconColor }}>{s.icon}</div>
                <span className={`sub-badge ${s.badge}`}>{s.badgeLabel}</span>
              </div>
              <div>
                <div className="sub-name">{s.name}</div>
                <div className="sub-meta">
                  <span>{s.period}</span>
                  <span>{s.note}</span>
                </div>
              </div>
              <div className="sub-foot">
                <span className="sub-amt">
                  {s.amount}
                  {s.share && (
                    <span
                      className="mono"
                      style={{
                        color: s.shareTone === "acc" ? "var(--accent)" : "var(--muted)",
                        fontSize: 11,
                        fontWeight: 400,
                        marginLeft: 5,
                      }}
                    >
                      {s.share}
                    </span>
                  )}
                </span>
                <span className={`sub-next${s.nextTone === "ok" ? " ok" : ""}`}>{s.next}</span>
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              {t("expenses.subscriptions.group.personal.empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
