import { BALANCE_FLOWS } from "@/lib/mock-family";

function Arrow() {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.6">
      <line x1="1" y1="5" x2="16" y2="5" />
      <path d="M12 1l4 4-4 4" />
    </svg>
  );
}

export function FamilyBalances() {
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>сверка</b> <span className="dim">· кто кому должен</span></div>
        <div className="meta mono">
          <button type="button" className="btn primary" style={{ padding: "3px 9px", fontSize: 10 }}>Провести выплату</button>
        </div>
      </div>
      <div className="bal-chord">
        {BALANCE_FLOWS.map((f, i) => (
          <div key={i} className="bal-flow" style={f.muted ? { opacity: .6 } : undefined}>
            <div className="who" style={f.muted ? { color: "var(--muted)" } : undefined}>
              <span className="ma" style={{ background: f.from.color }}>{f.from.letter}</span>
              {f.fromName}
            </div>
            <div className="arrow mono">
              {f.label}
              {!f.muted && <Arrow />}
            </div>
            {f.to ? (
              <div className="who">
                <span className="ma" style={{ background: f.to.color }}>{f.to.letter}</span>
                {f.toName}
              </div>
            ) : (
              <div className="who" style={{ color: "var(--muted)", justifyContent: "flex-end" }}>{f.toName}</div>
            )}
            <div className="amt" style={f.muted ? { color: "var(--dim)" } : undefined}>{f.amount}</div>
          </div>
        ))}
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", paddingTop: 6 }}>
          алгоритм: минимальное число переводов чтобы обнулить все разницы · следующая сверка — конец месяца (30 апр)
        </div>
      </div>
    </div>
  );
}
