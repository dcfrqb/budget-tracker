import { CountUp } from "@/components/count-up";
import { getT, getLocale } from "@/lib/i18n/server";
import { formatAgo } from "@/lib/fx/freshness";
import type { WalletTotalView } from "@/lib/view/wallet";

type Props = { totals: WalletTotalView[]; latestRecordedAt?: Date | null };

export async function WalletTotals({ totals, latestRecordedAt }: Props) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const ratesMeta = latestRecordedAt
    ? t("wallet.totals.rates_updated", { vars: { ago: formatAgo(latestRecordedAt, locale) } })
    : t("wallet.totals.rates_never");
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("wallet.totals.section_title")}</b>{" "}
          <span className="dim">· {t("wallet.totals.section_sub")}</span>
        </div>
        <div className="meta mono">{ratesMeta}</div>
      </div>
      <div className="section-body flush">
        <div className="totals">
          {totals.map((tot, i) => (
            <div key={i} className="total-cell">
              <div className="k">{tot.k}</div>
              <div className={`v ${tot.tone} money`}><CountUp to={tot.value} /> ₽</div>
              <div className="s">{tot.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
