export type BigPurchaseView = {
  id: string;
  icon: string;
  name: string;
  sub: string;
  dueLabel: string;
  pct: number;
  hoursMain: string;
  hoursSub: string;
  pctTone?: "warn" | "dim";
};

export function BigPurchases({
  purchases,
  hourlyRate,
}: {
  purchases: BigPurchaseView[];
  hourlyRate?: string;
}) {
  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>крупные покупки · прогресс</b></div>
        <div className="meta mono">
          {purchases.length} запланировано
          {hourlyRate ? ` · часы от ставки ${hourlyRate}` : ""}
        </div>
      </div>
      <div className="section-body flush">
        {purchases.map((p) => (
          <div key={p.id} className="bp-row" tabIndex={0}>
            <div className="bp-ico">{p.icon}</div>
            <div className="bp-main">
              <div className="bp-name">{p.name}</div>
              <div className="bp-sub">{p.sub}</div>
            </div>
            <div className="bp-target">срок<b>{p.dueLabel}</b></div>
            <div className="bp-bar"><div className="fill" style={{ width: `${p.pct}%` }} /></div>
            <div className="bp-hrs">
              {p.hoursMain}
              <br />
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>{p.hoursSub}</span>
            </div>
            <div
              className="bp-pct"
              style={{
                color:
                  p.pctTone === "warn" ? "var(--warn)" :
                  p.pctTone === "dim"  ? "var(--dim)"  :
                  undefined,
              }}
            >
              {p.pct}%
            </div>
          </div>
        ))}
        {purchases.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет крупных покупок
          </div>
        )}
      </div>
    </div>
  );
}
