import { CASH_STASH } from "@/lib/mock-wallet";

export function CashStashSection() {
  return (
    <div className="section fade-in" style={{ animationDelay: "340ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>наличка</b> <span className="dim">· разные локации и валюты</span>
        </div>
        <div className="meta mono">3 локации · 2 валюты · ₽ 18 400 итого</div>
      </div>
      <div className="section-body flush">
        <div className="cash-grid">
          {CASH_STASH.map((c) => (
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
