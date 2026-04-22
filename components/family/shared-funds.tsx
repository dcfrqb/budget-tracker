import { SHARED_FUNDS } from "@/lib/mock-family";

export function SharedFunds() {
  return (
    <div className="section fade-in" style={{ animationDelay: "320ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>общие накопления</b> <span className="dim">· кто сколько вложил</span></div>
        <div className="meta mono">2 активных фонда · +₽ 14 500 / мес всего</div>
      </div>
      <div className="section-body flush">
        <div className="sfund-grid">
          {SHARED_FUNDS.map((f) => (
            <article key={f.id} className="sfund-card" tabIndex={0}>
              <div className="sfund-top">
                <span className="sfund-kind">{f.kindLabel}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{f.due}</span>
              </div>
              <div className="sfund-name">
                {f.name}
                <div className="sub">{f.sub}</div>
              </div>
              <div className="sfund-contrib">
                {f.contrib.map((c, i) => (
                  <div key={i} className="c">
                    <div className="who" style={!c.avLetter ? { color: "var(--accent)" } : undefined}>
                      {c.avLetter && (
                        <span className="mini-av" style={{ background: c.avColor }}>{c.avLetter}</span>
                      )}
                      {c.who}
                    </div>
                    <div className={`am ${c.tone ?? ""}`}>{c.amount}</div>
                  </div>
                ))}
              </div>
              <div className="sfund-prog">
                <div className="fill" style={{ width: `${f.pct}%` }} />
              </div>
              <div className="sfund-foot">
                <span className="k">прогресс</span>
                <span className="v">{f.footV}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
