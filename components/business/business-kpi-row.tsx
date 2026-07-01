import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import type { Prisma } from "@prisma/client";
import type { BusinessPnLTotals } from "@/lib/data/businesses";

interface Props {
  totals: BusinessPnLTotals;
  cumulativeProfit: Prisma.Decimal;
  currencyCode: string;
}

export async function BusinessKpiRow({ totals, cumulativeProfit, currencyCode }: Props) {
  const t = await getT();

  const profitTone = totals.profit.gte(0) ? "pos" : "neg";
  const cumulativeTone = cumulativeProfit.gte(0) ? "pos" : "neg";

  const revenueFmt = formatMoney(totals.revenue, currencyCode);
  const expensesFmt = formatMoney(totals.expenses, currencyCode);
  const profitFmt = formatMoney(totals.profit, currencyCode, { signDisplay: "always" });
  const cumulativeFmt = formatMoney(cumulativeProfit, currencyCode, { signDisplay: "always" });

  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("business.detail.kpi.section_title")}</b>
        </div>
      </div>
      <div className="section-body flush">
        <div className="kpi-row">
          <div className="kpi">
            <div className="c pos">{t("business.detail.kpi.revenue")}</div>
            <div className="v pos">{revenueFmt}</div>
            <div className="s">{t("business.detail.kpi.revenue_sub")}</div>
          </div>
          <div className="kpi">
            <div className="c warn">{t("business.detail.kpi.expenses")}</div>
            <div className="v warn">{expensesFmt}</div>
            <div className="s">{t("business.detail.kpi.expenses_sub")}</div>
          </div>
          <div className="kpi">
            <div className={`c ${profitTone}`}>{t("business.detail.kpi.profit")}</div>
            <div className={`v ${profitTone}`}>{profitFmt}</div>
            <div className="s">{t("business.detail.kpi.profit_sub")}</div>
          </div>
          <div className="kpi">
            <div className={`c ${cumulativeTone}`}>{t("business.detail.kpi.cumulative")}</div>
            <div className={`v ${cumulativeTone}`}>{cumulativeFmt}</div>
            <div className="s">{t("business.detail.kpi.cumulative_sub")}</div>
          </div>
        </div>
        {totals.passThrough.gt(0) && (
          <div className="field-hint" style={{ padding: "0 var(--sp-3) var(--sp-3)" }}>
            {t("business.detail.kpi.pass_through_note")}
          </div>
        )}
      </div>
    </div>
  );
}
