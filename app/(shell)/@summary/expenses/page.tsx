import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getLoans } from "@/lib/data/loans";
import { getSubscriptionsGrouped } from "@/lib/data/subscriptions";
import { computeAmortization } from "@/lib/amortization";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { Prisma } from "@prisma/client";
import { formatRubPrefix } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server";

type ReservedRow = { k: string; tag: string; v: string; tone: string };

export default async function ExpensesSummary() {
  const now = new Date();
  const window30End = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const [loans, subsGrouped, rates] = await Promise.all([
    getLoans(userId),
    getSubscriptionsGrouped(userId),
    getLatestRatesMap(),
  ]);

  let loanReserve = new Prisma.Decimal(0);
  for (const loan of loans) {
    const paidCount = loan.payments.length;
    const schedule = computeAmortization({
      principal: new Prisma.Decimal(loan.principal),
      annualRatePct: new Prisma.Decimal(loan.annualRatePct),
      termMonths: loan.termMonths,
      startDate: loan.startDate,
    });
    const nextRow = schedule.find(r => r.n > paidCount && r.date >= now && r.date <= window30End);
    if (nextRow) {
      const inBase = convertToBase(nextRow.payment, loan.currencyCode, DEFAULT_CURRENCY, rates);
      if (inBase) loanReserve = loanReserve.plus(inBase);
    }
  }

  const subsMonthly = subsGrouped.totals.monthlyBase;
  const totalReserve = loanReserve.plus(subsMonthly);

  const reservedRows: ReservedRow[] = [
    { k: t("summary.expenses.loans_key"), tag: "loan", v: formatRubPrefix(loanReserve), tone: loanReserve.gt(0) ? "var(--warn)" : "var(--muted)" },
    { k: t("summary.expenses.subs_key"), tag: "sub", v: formatRubPrefix(subsMonthly), tone: "var(--info)" },
  ];

  const toneMap = { text: "var(--text)", info: "var(--info)", acc: "var(--accent)" } as const;

  const subsMonthlyRows = [
    { k: t("summary.expenses.personal_key"), v: formatRubPrefix(subsGrouped.totals.personalBase), tone: "text" as const },
    { k: t("summary.expenses.split_key"), v: formatRubPrefix(subsGrouped.totals.splitBase), tone: "info" as const },
    { k: t("summary.expenses.paid_for_others_key"), v: formatRubPrefix(subsGrouped.totals.paidForOthersBase), tone: "acc" as const },
    { k: t("summary.expenses.total_key"), v: formatRubPrefix(subsMonthly), tone: "text" as const },
  ];

  return (
    <SummaryShell>
      <SafeUntilBlock />
      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.expenses.reserve_label")}</span>
          <span className="tiny mono">{formatRubPrefix(totalReserve)}</span>
        </div>
        <div className="reserved">
          {reservedRows.map((r) => (
            <div key={r.k} className="r">
              <span><span className={`c ${r.tag}`} />{r.k}</span>
              <span className="mono" style={{ color: r.tone }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
      <AvailableBlock />
      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.expenses.subs_label")}</span>
          <span className="tiny mono">{formatRubPrefix(subsMonthly)}</span>
        </div>
        <div className="sum-table">
          {subsMonthlyRows.map((r) => (
            <div key={r.k} className="r">
              <span>{r.k}</span>
              <span className="mono" style={{ color: toneMap[r.tone] }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: t("summary.expenses.mode_key"), v: t("summary.expenses.mode_val"), vClass: "pos" },
          { tone: loanReserve.gt(0) ? "warn" : "pos", k: t("summary.expenses.reserve_key"), v: formatRubPrefix(totalReserve), vClass: loanReserve.gt(0) ? "neg" : "muted" },
          { tone: "pos", k: t("summary.expenses.subs_count_key"), v: String(subsGrouped.totals.activeCount), vClass: "acc" },
        ]}
      />
    </SummaryShell>
  );
}
