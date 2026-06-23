export const dynamic = "force-dynamic";

import { CountUp } from "@/components/count-up";
import {
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getWalletTotals } from "@/lib/data/wallet";
import { getT } from "@/lib/i18n/server";

function getCurrencySymbol(ccy: string): string {
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === ccy);
  return found ? found.symbol : ccy;
}

export default async function WalletSummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const totals = await getWalletTotals(userId, DEFAULT_CURRENCY);

  const holdings = totals.holdingsByCurrency;
  const totalAccountCount = holdings.reduce((sum, e) => sum + e.accountsCount, 0);

  const fallbackSymbol = getCurrencySymbol(DEFAULT_CURRENCY);

  return (
    <SummaryShell>
      <div className="sum-block" style={{ padding: "12px 8px" }}>
        <div className="net-hero">
          <div className="lbl">
            <span>{t("summary.wallet.net_label")}</span>
          </div>
          {holdings.length === 0 ? (
            <div className="row">
              <span className="big mono money">
                <CountUp to={0} /> {fallbackSymbol}
              </span>
            </div>
          ) : (
            holdings.map((entry) => {
              const symbol = getCurrencySymbol(entry.ccy);
              const amount = Number(entry.value.toFixed(0));
              return (
                <div className="row" key={entry.ccy}>
                  <span className="big mono money">
                    <CountUp to={amount} /> {symbol}
                  </span>
                </div>
              );
            })
          )}
          <div className="sub mono">{t("summary.wallet.accounts_sub", { vars: { n: String(totalAccountCount) } })}</div>
        </div>
      </div>

      <SessionStateBlock
        rows={[
          { tone: "pos", k: t("summary.wallet.mode_key"), v: t("summary.wallet.mode_val"), vClass: "pos" },
          { tone: "pos", k: t("summary.wallet.view_key"), v: t("summary.wallet.view_val"), vClass: "acc" },
          { tone: "muted", k: t("summary.wallet.accounts_key"), v: String(totals.net.accountsCount), vClass: "muted" },
        ]}
      />
    </SummaryShell>
  );
}
