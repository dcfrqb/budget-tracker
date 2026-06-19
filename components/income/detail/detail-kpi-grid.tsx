import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import type { WorkSourceKpis } from "@/lib/data/work-sources";

interface Props {
  kpis: WorkSourceKpis;
  taxRatePct: number | null;
  sourceCcy: string;
  baseCcy: string;
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
}

function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="kpi">
      <div className="c">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

export async function DetailKpiGrid({ kpis, taxRatePct, sourceCcy, baseCcy }: Props) {
  const t = await getT();

  const totalIncomeFmt = formatMoney(kpis.totalIncome, sourceCcy);
  const baseSub =
    sourceCcy !== baseCcy && kpis.totalIncomeBase.gt(0)
      ? t("income.work.detail.currency.base_annotation", {
          vars: {
            amount: formatMoney(kpis.totalIncomeBase, baseCcy),
            ccy: baseCcy,
          },
        })
      : undefined;

  const avgFmt = formatMoney(kpis.avgPerMonth, sourceCcy, { decimals: 0 });

  const rateFmt = kpis.effectiveHourlyRate
    ? formatMoney(kpis.effectiveHourlyRate, sourceCcy)
    : "—";

  const taxFmt = formatMoney(kpis.estimatedTax, sourceCcy);
  const taxHint =
    taxRatePct != null && taxRatePct > 0
      ? t("income.work.detail.kpi.tax_hint", {
          vars: { pct: String(taxRatePct) },
        })
      : undefined;

  return (
    <div
      className="ws-detail"
      style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="ws-kpi-grid">
        <KpiCard
          label={t("income.work.detail.kpi.total_income")}
          value={totalIncomeFmt}
          sub={baseSub}
        />
        <KpiCard
          label={t("income.work.detail.kpi.txn_count")}
          value={String(kpis.txnCount)}
        />
        <KpiCard
          label={t("income.work.detail.kpi.avg_per_month")}
          value={avgFmt}
        />
        <KpiCard
          label={t("income.work.detail.kpi.effective_rate")}
          value={rateFmt}
        />
        <KpiCard
          label={t("income.work.detail.kpi.estimated_tax")}
          value={taxFmt}
          sub={taxHint}
        />
      </div>
    </div>
  );
}
