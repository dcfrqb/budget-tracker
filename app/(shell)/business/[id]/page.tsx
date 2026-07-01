import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT } from "@/lib/i18n/server";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { getBusinessWithCounts, getBusinessPnL } from "@/lib/data/businesses";
import { periodBounds, type PeriodCode } from "@/lib/data/_period";
import { BusinessKpiRow } from "@/components/business/business-kpi-row";
import { PnLMatrix } from "@/components/business/pnl-matrix";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}

const PERIOD_CODES: PeriodCode[] = ["1m", "3m", "6m", "12m", "all"];

export default async function BusinessDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [userId, t, tz] = await Promise.all([getCurrentUserId(), getT(), getCurrentUserTz()]);

  const detail = await getBusinessWithCounts(userId, id);
  if (!detail) notFound();

  const periodValue = (PERIOD_CODES.includes(sp.period as PeriodCode) ? sp.period : "6m") as PeriodCode;
  const bounds = periodBounds(periodValue, tz);

  const pnl = await getBusinessPnL(userId, id, bounds, detail.business.currencyCode);
  const cumulativeProfit = pnl.rows.length > 0
    ? pnl.rows[pnl.rows.length - 1].cumulativeProfit
    : pnl.totals.profit;

  return (
    <>
      <div className="section fade-in" style={{ animationDelay: "0ms" }}>
        <div className="section-hd">
          <div className="ttl mono">
            <b>{detail.business.name}</b>
            {!detail.business.isActive && (
              <span className="dim"> · {t("business.card.inactive")}</span>
            )}
          </div>
          <div className="meta mono" style={{ display: "flex", gap: "var(--sp-2)" }}>
            <Link href={`/transactions/new?businessId=${id}`} className="btn btn-xs">
              {t("business.detail.add_entry")}
            </Link>
            <Link href={`/business/${id}/edit`} className="btn btn-xs">
              {t("business.detail.edit")}
            </Link>
          </div>
        </div>
        <div className="section-body flush">
          <div className="seg mono" role="tablist" style={{ padding: "var(--sp-2) var(--sp-3)" }}>
            {PERIOD_CODES.map((code) => (
              <Link
                key={code}
                href={`/business/${id}?period=${code}`}
                role="tab"
                aria-selected={periodValue === code}
                className={`seg-btn${periodValue === code ? " active" : ""}`}
              >
                {t(`business.detail.period.${code}` as Parameters<typeof t>[0])}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <BusinessKpiRow
        totals={pnl.totals}
        cumulativeProfit={cumulativeProfit}
        currencyCode={detail.business.currencyCode}
      />

      <PnLMatrix rows={pnl.rows} currencyCode={detail.business.currencyCode} />

      {detail.txnCount === 0 && (
        <div className="section fade-in">
          <div className="section-body">
            <p className="field-hint">{t("business.detail.empty_txns")}</p>
          </div>
        </div>
      )}
    </>
  );
}
