import { CountUp } from "@/components/count-up";
import {
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getInstitutionsWithAccounts } from "@/lib/data/wallet";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { Prisma } from "@prisma/client";
import { formatAmount, formatRubPrefix } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server";
import { db } from "@/lib/db";

const BAR_COLORS = [
  "var(--accent)", "var(--info)", "var(--pos)", "var(--warn)",
  "var(--chart-5)", "var(--chart-6)",
];

export default async function WalletSummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const [institutions, rates, currencies] = await Promise.all([
    getInstitutionsWithAccounts(userId),
    getLatestRatesMap(),
    db.currency.findMany({ select: { code: true, symbol: true, decimals: true, name: true } }),
  ]);

  const currencyMap = new Map(currencies.map((c) => [c.code, c]));

  let totalBase = new Prisma.Decimal(0);
  const instTotals: { name: string; total: Prisma.Decimal }[] = [];
  const ccyMap = new Map<string, Prisma.Decimal>();

  for (const inst of institutions) {
    let instTotal = new Prisma.Decimal(0);
    for (const acc of inst.accounts) {
      // UI list shows all accounts; aggregates only count included ones
      if (!acc.includeInAnalytics) continue;
      const inBase = convertToBase(acc.balance, acc.currencyCode, DEFAULT_CURRENCY, rates);
      if (inBase) {
        instTotal = instTotal.plus(inBase);
        totalBase = totalBase.plus(inBase);
      }
      const prev = ccyMap.get(acc.currencyCode) ?? new Prisma.Decimal(0);
      ccyMap.set(acc.currencyCode, prev.plus(new Prisma.Decimal(acc.balance)));
    }
    if (instTotal.gt(0)) {
      instTotals.push({ name: inst.name, total: instTotal });
    }
  }

  const instShares = instTotals.map((inst, i) => ({
    k: inst.name,
    pct: totalBase.isZero() ? 0 : Math.round(inst.total.div(totalBase).times(100).toNumber()),
    color: BAR_COLORS[i % BAR_COLORS.length],
  }));

  const baseCurrency = currencyMap.get(DEFAULT_CURRENCY) ?? {
    code: DEFAULT_CURRENCY, symbol: DEFAULT_CURRENCY, decimals: 2, name: DEFAULT_CURRENCY,
  };

  const ccyBalances = [...ccyMap.entries()].map(([code, amount]) => {
    const ccy = currencyMap.get(code) ?? { code, symbol: code, decimals: 2, name: code };
    const inBase = convertToBase(amount, code, DEFAULT_CURRENCY, rates);
    const rubStr = inBase ? formatRubPrefix(new Prisma.Decimal(inBase.toFixed(0))) : "—";
    return {
      sym: ccy.symbol,
      val: formatAmount(amount, ccy),
      rub: rubStr,
    };
  });

  const totalNum = Number(totalBase.toFixed(0));
  const accountCount = institutions.reduce((s, i) => s + i.accounts.length, 0);
  const totalStr = formatRubPrefix(new Prisma.Decimal(totalNum));

  return (
    <SummaryShell>
      <div className="sum-block" style={{ padding: "12px 8px" }}>
        <div className="net-hero">
          <div className="lbl">
            <span>{t("summary.wallet.net_label")}</span>
            <span className="tiny">{baseCurrency.symbol} {DEFAULT_CURRENCY}</span>
          </div>
          <div className="row">
            <span className="big mono">
              {baseCurrency.symbol} <CountUp to={totalNum} />
            </span>
          </div>
          <div className="sub mono">{t("summary.wallet.accounts_sub", { vars: { n: String(accountCount) } })}</div>
        </div>
      </div>

      {instShares.length > 0 && (
        <div className="sum-block">
          <div className="lbl">
            <span>{t("summary.wallet.inst_share_label")}</span>
            <span className="tiny mono">{t("summary.wallet.inst_share_meta")}</span>
          </div>
          <div className="share-bar">
            {instShares.map((s, i) => (
              <span key={i} style={{ width: `${s.pct}%`, background: s.color }} title={s.k} />
            ))}
          </div>
          <div className="inst-share">
            {instShares.map((s, i) => (
              <div key={i} className="r">
                <span className="k"><span className="sw" style={{ background: s.color }} />{s.k}</span>
                <span className="v">{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ccyBalances.length > 0 && (
        <div className="sum-block">
          <div className="lbl">
            <span>{t("summary.wallet.ccy_label")}</span>
            <span className="tiny mono">{accountCount} {t("summary.wallet.accounts_key")}</span>
          </div>
          {ccyBalances.map((b, i) => (
            <div key={i} className="bal-item with-rub">
              <span className="bal-sym mono">{b.sym}</span>
              <span className="bal-val mono">{b.val}</span>
              <span className="bal-rub mono">{b.rub}</span>
            </div>
          ))}
        </div>
      )}

      {ccyBalances.length === 0 && (
        <div className="sum-block">
          <div className="lbl"><span>{t("summary.wallet.accounts_label")}</span></div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{t("summary.wallet.no_accounts")}</div>
        </div>
      )}

      <SessionStateBlock
        rows={[
          { tone: "pos", k: t("summary.wallet.mode_key"), v: t("summary.wallet.mode_val"), vClass: "pos" },
          { tone: "pos", k: t("summary.wallet.view_key"), v: t("summary.wallet.view_val"), vClass: "acc" },
          { tone: "muted", k: t("summary.wallet.accounts_key"), v: String(accountCount), vClass: "muted" },
        ]}
      />
    </SummaryShell>
  );
}
