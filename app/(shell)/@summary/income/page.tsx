import { CountUp } from "@/components/count-up";
import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { formatRubPrefix } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server";

export default async function IncomeSummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const window14End = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;
  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));

  const [monthTxns, upcomingTxns, rates] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
        occurredAt: { gte: monthStart, lte: monthEnd },
      },
      select: {
        status: true,
        amount: true,
        currencyCode: true,
        facts: { select: { amount: true } },
      },
    }),
    db.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        kind: TransactionKind.INCOME,
        status: TransactionStatus.PLANNED,
        occurredAt: { gte: now, lte: window14End },
      },
      select: {
        name: true,
        amount: true,
        currencyCode: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: "asc" },
      take: 5,
    }),
    getLatestRatesMap(),
  ]);

  let monthFact = new Prisma.Decimal(0);
  for (const tx of monthTxns) {
    const actual = tx.status === "DONE"
      ? new Prisma.Decimal(tx.amount)
      : tx.facts.reduce((s, f) => s.plus(f.amount), new Prisma.Decimal(0));
    const inBase = convertToBase(actual, tx.currencyCode, DEFAULT_CURRENCY, rates);
    if (inBase) monthFact = monthFact.plus(inBase);
  }

  const upcomingRows = upcomingTxns.map((tx) => {
    const diffDays = Math.ceil((tx.occurredAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const sym = tx.currencyCode === "RUB" ? "₽" : tx.currencyCode === "USD" ? "$" : tx.currencyCode === "EUR" ? "€" : tx.currencyCode;
    return {
      d: `${tx.occurredAt.getUTCDate()} ${monthShort[tx.occurredAt.getUTCMonth()]}`,
      n: tx.name,
      v: `${sym} ${Number(new Prisma.Decimal(tx.amount).toFixed(0)).toLocaleString("ru-RU")} · ${diffDays}${t("common.unit.day")}`,
    };
  });

  const monthLabel = `${monthShort[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const factNum = Number(monthFact.toFixed(0));

  return (
    <SummaryShell>
      <SafeUntilBlock />
      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.income.month_label")}</span>
          <span className="tiny mono">{monthLabel}</span>
        </div>
        <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--pos)" }}>
          +₽ <CountUp to={factNum} />
        </div>
        <div className="sum-table" style={{ marginTop: 6 }}>
          <div className="r"><span>{t("summary.income.fact_key")}</span><span className="v">{formatRubPrefix(monthFact)}</span></div>
        </div>
      </div>
      <div className="sum-block">
        <div className="lbl">
          <span>{t("summary.income.upcoming_label")}</span>
          <span className="tiny mono">{t("summary.income.upcoming_meta")}</span>
        </div>
        <div className="inc-upcoming">
          {upcomingRows.map((r, i) => (
            <div key={i} className="r">
              <span className="d mono">{r.d}</span>
              <span className="n">{r.n}</span>
              <span className="v mono">{r.v}</span>
            </div>
          ))}
          {upcomingRows.length === 0 && (
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              {t("summary.income.upcoming_none")}
            </div>
          )}
        </div>
      </div>
      <AvailableBlock />
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: t("summary.income.mode_key"), v: t("summary.income.mode_val"), vClass: "pos" },
          { tone: "pos", k: t("summary.income.view_key"), v: t("summary.income.view_val"), vClass: "acc" },
          {
            tone: upcomingRows.length > 0 ? "warn" : "pos",
            k: t("summary.income.nearest_key"),
            v: upcomingRows.length > 0 ? upcomingRows[0].v : t("summary.income.nearest_none"),
            vClass: upcomingRows.length > 0 ? "warn" : "muted",
          },
        ]}
      />
    </SummaryShell>
  );
}
