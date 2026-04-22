import { TAX_HINTS } from "@/lib/mock-expenses";

export function Taxes() {
  return (
    <div className="section fade-in" style={{ animationDelay: "360ms", marginBottom: 0 }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>налоги</b> <span className="dim">· только подсказки · платить вручную</span>
        </div>
        <div className="meta mono">{TAX_HINTS.length} отслеж.</div>
      </div>
      <div>
        {TAX_HINTS.map((t) => (
          <div key={t.id} className="tax-card">
            <div className="l">
              <div className="t">{t.title}</div>
              <div className="s">{t.sub}</div>
            </div>
            <div className="r">
              <span className="due" style={{ color: t.dueTone === "muted" ? "var(--muted)" : undefined }}>{t.dueLabel}</span>
              <span className="amt" style={{ color: t.amountTone === "muted" ? "var(--muted)" : undefined }}>{t.amount}</span>
              <button type="button" className={`btn${t.buttonKind === "urgent" ? " urgent" : ""}`}>{t.buttonLabel}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
