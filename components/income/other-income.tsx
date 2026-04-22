import { OTHER_INCOME } from "@/lib/mock-income";

export function OtherIncome() {
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
        {OTHER_INCOME.map((o) => (
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
      </div>
    </div>
  );
}
