import { FUNDS } from "@/lib/mock-planning";

export function FundsSection() {
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>накопления / цели</b> <span className="dim">· 6 активных фондов</span></div>
        <div className="meta mono">
          <button type="button" className="btn primary" style={{ padding: "3px 9px", fontSize: 10 }}>
            + Новый фонд
          </button>
        </div>
      </div>
      <div className="section-body flush">
        <div className="fund-grid">
          {FUNDS.map((f) => (
            <article key={f.id} className="fund-card" tabIndex={0}>
              <div className="fund-top">
                <span className={`fund-kind ${f.kind}`}>{f.kindLabel}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{f.dueLabel}</span>
              </div>
              <div className="fund-name">
                {f.name}
                <div className="sub">{f.sub}</div>
              </div>
              <div className="fund-stats">
                {f.stats.map((s, i) => (
                  <div key={i}>
                    <div className="k">{s.k}</div>
                    <div className={`v ${s.tone ?? ""}`}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="fund-prog-wrap">
                <div className="fund-prog-lbl">
                  <span>{f.progLeft}</span>
                  <span>{f.progRight}</span>
                </div>
                <div className="fund-prog">
                  <div className="fill" style={{ width: `${f.pct}%` }} />
                </div>
              </div>
              <div className="fund-hours">
                <span>часов работы до цели</span>
                <span><span className="hrs">{f.hours}</span> <span className="unit">{f.hoursUnit}</span></span>
              </div>
            </article>
          ))}
          <article className="fund-card add" tabIndex={0}>
            <div>
              <div className="plus">+</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text)" }}>новый фонд</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--dim)", marginTop: 4 }}>
                покупка · трип · подушка · цель
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button type="button" className="btn" style={{ fontSize: 10, padding: "4px 10px" }}>Покупка</button>
                <button type="button" className="btn" style={{ fontSize: 10, padding: "4px 10px" }}>Трип</button>
                <button type="button" className="btn" style={{ fontSize: 10, padding: "4px 10px" }}>Подушка</button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
