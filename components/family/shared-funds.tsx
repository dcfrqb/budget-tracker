export type SharedFundContrib = {
  avLetter?: string;
  avColor?: string;
  who: string;
  amount: string;
  tone?: string;
};

export type SharedFundCard = {
  id: string;
  kindLabel: string;
  due: string;
  name: string;
  sub: string;
  contrib: SharedFundContrib[];
  pct: number;
  footV: string;
};

export function SharedFunds({ funds }: { funds: SharedFundCard[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "320ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>общие накопления</b> <span className="dim">· кто сколько вложил</span></div>
        <div className="meta mono">{funds.length} активных фондов</div>
      </div>
      <div className="section-body flush">
        <div className="sfund-grid">
          {funds.map((f) => (
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
          {funds.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              нет общих накоплений
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
