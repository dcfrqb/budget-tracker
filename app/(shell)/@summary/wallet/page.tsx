import { CountUp } from "@/components/count-up";
import {
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getWalletTotals } from "@/lib/data/wallet";
import { getT } from "@/lib/i18n/server";

export default async function WalletSummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const totals = await getWalletTotals(userId, DEFAULT_CURRENCY);

  const totalNum = Number(totals.net.valueBase.toFixed(0));
  const accountCount = totals.net.accountsCount;

  return (
    <SummaryShell>
      <div className="sum-block" style={{ padding: "12px 8px" }}>
        <div className="net-hero">
          <div className="lbl">
            <span>{t("summary.wallet.net_label")}</span>
            <span className="tiny">₽ {DEFAULT_CURRENCY}</span>
          </div>
          <div className="row">
            <span className="big mono">
              ₽ <CountUp to={totalNum} />
            </span>
          </div>
          <div className="sub mono">{t("summary.wallet.accounts_sub", { vars: { n: String(accountCount) } })}</div>
        </div>
      </div>

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
