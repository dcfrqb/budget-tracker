import type { CashStashView } from "@/lib/view/wallet";

type Props = { stash: CashStashView[]; meta: string };

export function CashStashSection({ stash, meta }: Props) {
  return (
    <div className="section fade-in" style={{ animationDelay: "340ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>наличка</b> <span className="dim">· разные локации и валюты</span>
        </div>
        <div className="meta mono">{meta}</div>
      </div>
      <div className="section-body flush">
        <div className="cash-grid">
          {stash.map((c) => (
            <div key={c.id} className="cash-cell" tabIndex={0}>
              <div className="top">
                <span className="sym mono">{c.sym}</span>
                <span className="loc mono">{c.loc}</span>
              </div>
              <div className="v">{c.value}</div>
              <div className="s">{c.sub}</div>
            </div>
          ))}
          <div className="cash-cell add" tabIndex={0}>
            <div>
              <div style={{ fontSize: 18, color: "var(--accent)" }}>+</div>
              <div className="mono" style={{ fontSize: 11, marginTop: 3 }}>новая локация</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
