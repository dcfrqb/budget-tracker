import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { periodBounds } from "@/lib/data/_period";
import type { PeriodCode } from "@/lib/data/_period";
import {
  getWorkSourceWithCounts,
  getWorkSourceMonthlySeries,
  getWorkSourceKpis,
  getWorkSourceTransactions,
  getWorkSourceFreelanceOrders,
  getEmploymentMonthlyPlanFact,
  getFreelanceLatencyKpis,
  getSyntheticForecast,
  getFreelanceOrderStatusBreakdown,
} from "@/lib/data/work-sources";
import { TransactionStatus } from "@prisma/client";
import { listAllCurrencies } from "@/lib/data/currencies";
import { listAccountsForQuickDrawer } from "@/lib/data/wallet";
import { DetailHeader } from "@/components/income/detail/detail-header";
import { DetailPeriodTabs } from "@/components/income/detail/detail-period-tabs";
import { DetailKpiGrid } from "@/components/income/detail/detail-kpi-grid";
import { MonthlyBarChart } from "@/components/income/detail/monthly-bar-chart";
import { CumulativeLineChart } from "@/components/income/detail/cumulative-line-chart";
import { TransactionsList } from "@/components/income/detail/transactions-list";
import { FreelanceOrdersPanel } from "@/components/income/detail/freelance-orders-panel";
import { EmploymentPlanGrid } from "@/components/income/detail/employment-plan-grid";
import { FreelanceLatencyKpisBlock } from "@/components/income/detail/freelance-latency-kpis";
import { SyntheticForecastBlock } from "@/components/income/detail/synthetic-forecast-block";
import { OrderStatusBreakdown } from "@/components/income/detail/order-status-breakdown";

export const dynamic = "force-dynamic";

const VALID_PERIODS: PeriodCode[] = ["1m", "3m", "6m", "12m", "all"];
const STATUS_MAP: Record<string, TransactionStatus[]> = {
  done: [TransactionStatus.DONE],
  planned: [TransactionStatus.PLANNED],
  partial: [TransactionStatus.PARTIAL],
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; status?: string }>;
}

export default async function WorkSourceDetailPage({ params, searchParams }: Props) {
  const [userId, tz] = await Promise.all([
    getCurrentUserId(),
    getCurrentUserTz(),
  ]);

  const { id } = await params;
  const sp = await searchParams;

  const detail = await getWorkSourceWithCounts(userId, id);
  if (!detail) notFound();

  const { source } = detail;

  const period: PeriodCode = VALID_PERIODS.includes(sp.period as PeriodCode)
    ? (sp.period as PeriodCode)
    : "3m";

  const bounds = periodBounds(period, tz);
  const basePath = `/income/work-sources/${id}`;

  const statusFilter = STATUS_MAP[sp.status ?? ""] ?? undefined;

  const [kpis, monthlySeries] = await Promise.all([
    getWorkSourceKpis(userId, id, bounds, DEFAULT_CURRENCY),
    getWorkSourceMonthlySeries(userId, id, bounds),
  ]);

  const txns = await getWorkSourceTransactions(userId, id, bounds, statusFilter);

  const isFreelance = source.kind === "FREELANCE";
  const isEmployment = source.kind === "EMPLOYMENT";

  const [freelanceOrders, planRows, freelanceLatency, syntheticForecast, currencies, orderStatusBreakdown, accounts] =
    await Promise.all([
      isFreelance ? getWorkSourceFreelanceOrders(userId, id, bounds) : Promise.resolve([]),
      isEmployment ? getEmploymentMonthlyPlanFact(userId, id, bounds) : Promise.resolve([]),
      isFreelance
        ? getFreelanceLatencyKpis(userId, id, bounds)
        : Promise.resolve(null),
      isEmployment
        ? getSyntheticForecast(userId, id, 3)
        : Promise.resolve([]),
      isFreelance
        ? listAllCurrencies()
        : Promise.resolve([]),
      isFreelance
        ? getFreelanceOrderStatusBreakdown(userId, id, bounds)
        : Promise.resolve([]),
      isFreelance
        ? listAccountsForQuickDrawer(userId)
        : Promise.resolve([]),
    ]);

  const currencyOptions = currencies.map((c) => ({ code: c.code, symbol: c.symbol }));

  const taxRatePct = source.taxRatePct ? Number(source.taxRatePct.toString()) : null;

  return (
    <div className="page-content">
      <DetailHeader source={source} />
      <DetailPeriodTabs active={period} />
      <DetailKpiGrid
        kpis={kpis}
        taxRatePct={taxRatePct}
        sourceCcy={source.currencyCode}
        baseCcy={DEFAULT_CURRENCY}
      />
      <div className="ws-chart-row">
        <CumulativeLineChart series={monthlySeries} sourceCcy={source.currencyCode} />
        <MonthlyBarChart series={monthlySeries} sourceCcy={source.currencyCode} />
      </div>
      {isFreelance && (
        <FreelanceOrdersPanel
          orders={freelanceOrders}
          workSourceId={id}
          workSourceCurrency={source.currencyCode}
          currencies={currencyOptions}
          accounts={accounts}
        />
      )}
      {isFreelance && (
        <OrderStatusBreakdown
          rows={orderStatusBreakdown}
          sourceCcy={source.currencyCode}
        />
      )}
      {isFreelance && freelanceLatency && (
        <FreelanceLatencyKpisBlock kpis={freelanceLatency} />
      )}
      {isEmployment && (
        <EmploymentPlanGrid rows={planRows} sourceCcy={source.currencyCode} />
      )}
      {isEmployment && (
        <SyntheticForecastBlock entries={syntheticForecast} />
      )}
      <TransactionsList
        txns={txns}
        statusFilter={sp.status}
        basePath={basePath}
      />
    </div>
  );
}
