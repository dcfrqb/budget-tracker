import { INCOME_SIGNALS } from "@/lib/mock-income";

export function IncomeSignals() {
  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>сигналы</b> <span className="dim">· подсказки, не действия</span>
        </div>
        <div className="meta mono">{INCOME_SIGNALS.length} активно</div>
      </div>
      <div className="section-body">
        <div className="signals-col">
          {INCOME_SIGNALS.map((s) => (
            <div key={s.id} className={`sig ${s.kind}`}>
              <div className="k">{s.k}</div>
              <div className="m" dangerouslySetInnerHTML={{ __html: s.mHtml }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
