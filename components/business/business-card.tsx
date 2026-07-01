import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import type { BusinessCardSummary } from "@/lib/data/businesses";

interface BusinessesGridProps {
  items: BusinessCardSummary[];
}

export async function BusinessCardsGrid({ items }: BusinessesGridProps) {
  const t = await getT();

  return (
    <div className="ws-grid">
      {items.map((biz) => (
        <Link
          key={biz.id}
          href={`/business/${biz.id}`}
          className="ws-card"
          tabIndex={0}
          style={{ display: "flex", flexDirection: "column", gap: 10, textDecoration: "none" }}
        >
          <div className="ws-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="ws-tag other">{biz.currencyCode}</span>
            {!biz.isActive && (
              <span className="mono" style={{ fontSize: "var(--text-2xs)", color: "var(--muted)" }}>
                {t("business.card.inactive")}
              </span>
            )}
          </div>
          <div className="ws-title">
            {biz.name}
            {biz.note && <div className="sub">{biz.note}</div>}
          </div>
          <div className="ws-meta">
            <div>
              <div className="k">{t("business.card.period_revenue")}</div>
              <div className="v pos">{formatMoney(biz.periodRevenue, biz.currencyCode)}</div>
            </div>
            <div>
              <div className="k">{t("business.card.period_profit")}</div>
              <div className={`v ${biz.periodProfit.gte(0) ? "pos" : "neg"}`}>
                {formatMoney(biz.periodProfit, biz.currencyCode)}
              </div>
            </div>
          </div>
          <div className="mono" style={{ fontSize: "var(--text-2xs)", color: "var(--muted)" }}>
            {t("business.card.txn_count", { vars: { n: String(biz.txnCount) } })}
          </div>
        </Link>
      ))}
    </div>
  );
}
