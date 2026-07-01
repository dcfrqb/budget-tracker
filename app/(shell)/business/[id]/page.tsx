import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT } from "@/lib/i18n/server";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import {
  getBusinessWithCounts,
  getBusinessPnL,
  getBusinessRevenueByStream,
  getBusinessRevenueByTariff,
  getBusinessForecast,
} from "@/lib/data/businesses";
import { getTransactionById } from "@/lib/data/transactions";
import { listAllCurrencies } from "@/lib/data/currencies";
import { periodBounds, type PeriodCode } from "@/lib/data/_period";
import { BusinessKpiRow } from "@/components/business/business-kpi-row";
import { PnLMatrix } from "@/components/business/pnl-matrix";
import { StreamMatrix } from "@/components/business/stream-matrix";
import { TariffBreakdown } from "@/components/business/tariff-breakdown";
import { StreamChart } from "@/components/business/stream-chart";
import { PnLChart } from "@/components/business/pnl-chart";
import { TariffChart } from "@/components/business/tariff-chart";
import { ForecastChart } from "@/components/business/forecast-chart";
import { BusinessAllocationSheetHost } from "@/components/business/business-allocation-sheet-host";
import type { SplitTxnData } from "@/components/business/business-allocation-sheet-host";
import { SplitEntryControl } from "@/components/business/split-entry-control";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; split?: string }>;
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

  const [pnl, streamMatrix, tariffRows, forecast, currencies, splitTxnRow] = await Promise.all([
    getBusinessPnL(userId, id, bounds, detail.business.currencyCode),
    getBusinessRevenueByStream(userId, id, bounds, detail.business.currencyCode),
    getBusinessRevenueByTariff(userId, id, bounds, detail.business.currencyCode),
    getBusinessForecast(userId, id, bounds, detail.business.currencyCode),
    listAllCurrencies(),
    sp.split ? getTransactionById(userId, sp.split) : Promise.resolve(null),
  ]);

  const cumulativeProfit = pnl.rows.length > 0
    ? pnl.rows[pnl.rows.length - 1].cumulativeProfit
    : pnl.totals.profit;

  const splitTxn: SplitTxnData | undefined = splitTxnRow
    ? {
        id: splitTxnRow.id,
        amount: splitTxnRow.amount.toString(),
        currencyCode: splitTxnRow.currencyCode,
      }
    : undefined;

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
            <Link href="?new=offapp" scroll={false} className="btn btn-xs">
              {t("business.allocation.offapp.entry_cta")}
            </Link>
            <SplitEntryControl />
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

      <StreamChart matrix={streamMatrix} currencyCode={detail.business.currencyCode} />

      <PnLChart rows={pnl.rows} />

      <TariffChart rows={tariffRows} currencyCode={detail.business.currencyCode} />

      <ForecastChart forecast={forecast} />

      <PnLMatrix rows={pnl.rows} currencyCode={detail.business.currencyCode} />

      <StreamMatrix matrix={streamMatrix} currencyCode={detail.business.currencyCode} />

      <TariffBreakdown rows={tariffRows} currencyCode={detail.business.currencyCode} />

      {detail.txnCount === 0 && (
        <div className="section fade-in">
          <div className="section-body">
            <p className="field-hint">{t("business.detail.empty_txns")}</p>
          </div>
        </div>
      )}

      <BusinessAllocationSheetHost
        businessId={id}
        businessCurrencyCode={detail.business.currencyCode}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        splitTxn={splitTxn}
      />
    </>
  );
}
