import { CountUp } from "@/components/count-up";
import type { WalletTotalView } from "@/lib/view/wallet";

type Props = { totals: WalletTotalView[] };

export function WalletTotals({ totals }: Props) {
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>итого по кошельку</b> <span className="dim">· все счета в ₽</span></div>
        <div className="meta mono">курсы CBR · обновлены 12:30</div>
      </div>
      <div className="section-body flush">
        <div className="totals">
          {totals.map((t, i) => (
            <div key={i} className="total-cell">
              <div className="k">{t.k}</div>
              <div className={`v ${t.tone}`}>₽ <CountUp to={t.value} /></div>
              <div className="s">{t.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
