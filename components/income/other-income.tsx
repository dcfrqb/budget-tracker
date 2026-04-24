export type OtherIncomeRow = {
  id: string;
  icon: string;
  name: string;
  sub: string;
  src: string;
  date: string;
  amount: string;
  amountTone?: "warn" | "acc" | "info";
};

export function OtherIncome({ rows }: { rows: OtherIncomeRow[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>прочие поступления</b> <span className="dim">· не с работы</span>
        </div>
        <div className="meta mono">
          <button type="button" className="btn" style={{ padding: "3px 9px", fontSize: 10 }}>
            + Записать доход
          </button>
        </div>
      </div>
      <div className="section-body flush">
        {rows.map((o) => (
          <div key={o.id} className="other-row" tabIndex={0}>
            <div className="o-ico">{o.icon}</div>
            <div className="o-main">
              <div className="n">{o.name}</div>
              <div className="m">{o.sub}</div>
            </div>
            <span className="exp-src mono">{o.src}</span>
            <span className={`mono ${o.date.startsWith("+") ? "acc" : "mut"}`} style={{ fontSize: 11 }}>
              {o.date}
            </span>
            <div className={`exp-amt ${o.amountTone ?? ""}`}>{o.amount}</div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет прочих поступлений
          </div>
        )}
      </div>
    </div>
  );
}
