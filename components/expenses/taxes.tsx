export type TaxHintView = {
  id: string;
  title: string;
  sub: string;
  dueLabel: string;
  dueTone: "warn" | "muted";
  amount: string;
  amountTone: "warn" | "muted";
  buttonLabel: string;
  buttonKind: "urgent" | "default";
};

export function Taxes({ hints }: { hints: TaxHintView[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "360ms", marginBottom: 0 }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>налоги</b> <span className="dim">· только подсказки · платить вручную</span>
        </div>
        <div className="meta mono">{hints.length} отслеж.</div>
      </div>
      <div>
        {hints.map((t) => (
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
        {hints.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет налоговых подсказок
          </div>
        )}
      </div>
    </div>
  );
}
