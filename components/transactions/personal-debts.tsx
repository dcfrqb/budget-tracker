import { PERSONAL_DEBTS } from "@/lib/mock-transactions";

export function PersonalDebts() {
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>личные займы</b> <span className="dim">· активные</span>
        </div>
        <div className="meta mono">3 активно · net +₽ 27 000 out</div>
      </div>
      <div className="section-body flush">
        <div className="debt-grid">
          {PERSONAL_DEBTS.map((d) => (
            <div key={d.id} className="debt-card" tabIndex={0}>
              <div className="debt-top">
                <span className={`debt-dir ${d.dir}`}>{d.dirLabel}</span>
                <span className="debt-meta">с {d.since} · срок {d.until}</span>
              </div>
              <div>
                <div className="debt-name">{d.name}</div>
                <div className="debt-sub">{d.sub}</div>
              </div>
              <div className="debt-row">
                <span className={`debt-amt ${d.amountTone}`}>{d.amount}</span>
                <span className="debt-meta">{d.progressLabel}</span>
              </div>
              <div className="debt-prog">
                <div className="fill" style={{ width: `${d.progressPct}%` }} />
              </div>
            </div>
          ))}
          <div className="debt-card add" tabIndex={0}>
            <div>
              <div className="plus">+</div>
              <div className="mono" style={{ fontSize: 11 }}>новый личный займ</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--dim)", marginTop: 3 }}>
                выдал · взял
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
