export type BalanceFlowPerson = { letter: string; color: string };

export type BalanceFlow = {
  fromName: string;
  from?: BalanceFlowPerson;
  toName: string;
  to?: BalanceFlowPerson;
  label: string;
  amount: string;
  muted?: boolean;
};

function Arrow() {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.6">
      <line x1="1" y1="5" x2="16" y2="5" />
      <path d="M12 1l4 4-4 4" />
    </svg>
  );
}

export function FamilyBalances({ flows }: { flows: BalanceFlow[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>сверка</b> <span className="dim">· кто кому должен</span></div>
        <div className="meta mono">
          <button type="button" className="btn primary" style={{ padding: "3px 9px", fontSize: 10 }}>Провести выплату</button>
        </div>
      </div>
      <div className="bal-chord">
        {flows.map((f, i) => (
          <div key={i} className="bal-flow" style={f.muted ? { opacity: .6 } : undefined}>
            <div className="who" style={f.muted ? { color: "var(--muted)" } : undefined}>
              {f.from && <span className="ma" style={{ background: f.from.color }}>{f.from.letter}</span>}
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
        {flows.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет текущих задолженностей
          </div>
        )}
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", paddingTop: 6 }}>
          алгоритм: минимальное число переводов чтобы обнулить все разницы
        </div>
      </div>
    </div>
  );
}
