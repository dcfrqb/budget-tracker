import type { DebtView } from "@/lib/view/debts";

type Props = { debts: DebtView[]; metaLine: string };

export function PersonalDebts({ debts, metaLine }: Props) {
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>личные займы</b> <span className="dim">· активные</span>
        </div>
        <div className="meta mono">{metaLine}</div>
      </div>
      <div className="section-body flush">
        <div className="debt-grid">
          {debts.map((d) => (
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
