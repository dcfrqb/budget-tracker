import type { FxRateView } from "@/lib/view/wallet";

type Props = { rates: FxRateView[] };

export function FxRates({ rates }: Props) {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>курсы обмена</b> <span className="dim">· официальные · для переоценки</span>
        </div>
        <div className="meta mono">
          <button type="button" className="btn" style={{ padding: "3px 9px", fontSize: 10 }}>↻ Обновить</button>
        </div>
      </div>
      <div className="section-body flush">
        <div className="rates-row">
          {rates.map((r, i) => (
            <div key={i} className="rate">
              <span className="pair mono">{r.pair[0]}<b> / </b>{r.pair[1]}</span>
              <span>
                <span className="val">{r.val}</span>
                <span className={`delta ${r.deltaTone}`}>{r.delta}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
