import type { HomeObligationView } from "@/lib/view/home";

export function Obligations({ obligations }: { obligations: HomeObligationView[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>обязательства</b> <span className="dim">· ближ. 30д</span>
        </div>
        <div className="meta mono">{obligations.length} шт.</div>
      </div>
      <div className="section-body flush">
        <div className="ob-grid">
          {obligations.map((ob) => (
            <div key={ob.id} className={`ob-card ${ob.tagClass}`} tabIndex={0}>
              <div className="ob-top">
                <span className={`code-tag ${ob.tagClass}`}>{ob.tag}</span>
                <span className="date">{ob.date}</span>
              </div>
              <div>
                <div className="ob-name">{ob.name}</div>
                <div className="ob-sub">{ob.sub}</div>
              </div>
              <div className="ob-bot">
                <span className="ob-amt">{ob.amount}</span>
                <span className="mono dim" style={{ fontSize: 10 }}>
                  {ob.meta}
                </span>
              </div>
            </div>
          ))}
          {obligations.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              нет обязательств в ближайшие 30 дней
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
