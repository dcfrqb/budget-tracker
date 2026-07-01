export const dynamic = "force-dynamic";

import {
  AvailableBlock,
  BalancesBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getActiveBusinesses, getBusinessCardSummaries } from "@/lib/data/businesses";
import { convertToBase, getLatestRatesMap } from "@/lib/data/wallet";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import { getT } from "@/lib/i18n/server";

export default async function BusinessSummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const [activeBusinesses, summaries, rates] = await Promise.all([
    getActiveBusinesses(userId),
    getBusinessCardSummaries(userId),
    getLatestRatesMap(),
  ]);

  let periodRevenue = new Prisma.Decimal(0);
  let periodProfit = new Prisma.Decimal(0);
  for (const b of summaries) {
    const revenueInBase = convertToBase(b.periodRevenue, b.currencyCode, DEFAULT_CURRENCY, rates);
    const profitInBase = convertToBase(b.periodProfit, b.currencyCode, DEFAULT_CURRENCY, rates);
    if (revenueInBase) periodRevenue = periodRevenue.plus(revenueInBase);
    if (profitInBase) periodProfit = periodProfit.plus(profitInBase);
  }

  const rows = [
    { k: t("summary.business.count_key"), v: String(activeBusinesses.length), tone: "text" as const },
    { k: t("summary.business.revenue_key"), v: formatMoney(periodRevenue, DEFAULT_CURRENCY), tone: "pos" as const },
    { k: t("summary.business.profit_key"), v: formatMoney(periodProfit, DEFAULT_CURRENCY), tone: periodProfit.gte(0) ? ("pos" as const) : ("neg" as const) },
  ];

  const toneMap = { text: "var(--text)", pos: "var(--pos)", neg: "var(--neg)" } as const;

  return (
    <SummaryShell>
      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.business.label")}</span>
        </div>
        <div className="sum-table">
          {rows.map((r) => (
            <div key={r.k} className="r">
              <span>{r.k}</span>
              <span className="mono" style={{ color: toneMap[r.tone] }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
      <AvailableBlock />
      <BalancesBlock />
    </SummaryShell>
  );
}
