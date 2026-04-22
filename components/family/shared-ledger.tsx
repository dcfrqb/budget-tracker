import { SHARED_TXNS } from "@/lib/mock-family";

export function SharedLedger() {
  return (
    <div className="section fade-in" style={{ animationDelay: "280ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>общие транзакции</b> <span className="dim">· апрель · 35 штук</span></div>
        <div className="meta mono">разделение авто · равное, если не указано</div>
      </div>
      <div className="section-body flush">
        {SHARED_TXNS.map((t) => (
          <div key={t.id} className="shtxn-row" tabIndex={0}>
            <div className={`shtxn-ico ${t.kind}`}>Р</div>
            <div className="shtxn-date mono">
              {t.date}<br /><b>{t.weekday}</b>
            </div>
            <div className="shtxn-main">
              <div className="n">{t.name}</div>
              <div className="m">{t.sub}</div>
            </div>
            <span className="shtxn-paid mono">{t.paid}</span>
            <div className="shtxn-split">
              <span className="pp">{t.split}</span>
              <span>{t.splitPer}</span>
            </div>
            <span className="shtxn-cat mono">{t.cat}</span>
            <div className={`shtxn-amt ${t.kind}`}>{t.amount}</div>
          </div>
        ))}
        <div style={{ padding: "14px 20px", textAlign: "center" }}>
          <button type="button" className="btn">Показать ещё 28 · ↓</button>
        </div>
      </div>
    </div>
  );
}
