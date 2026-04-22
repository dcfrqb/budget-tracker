import { EXPECTED_INCOME } from "@/lib/mock-income";

const STATUS_CLASS = { confirmed: "st-confirmed", expected: "st-expected", await: "st-await" } as const;

export function ExpectedIncome() {
  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>ожидаемые поступления</b> <span className="dim">· ближ. 90д</span>
        </div>
        <div className="meta mono">{EXPECTED_INCOME.length} событий · ₽ 385 200 прогноз</div>
      </div>
      <div className="section-body flush">
        {EXPECTED_INCOME.map((e) => (
          <div key={e.id} className="expected-row" tabIndex={0}>
            <div className="exp-date mono">
              {e.date}
              <b>{e.weekday}</b>
              {e.inDays}
            </div>
            <div className="exp-main">
              <div className="n">{e.name}</div>
              <div className="m">{e.sub}</div>
            </div>
            <span className="exp-src mono">{e.src}</span>
            <span className={`exp-st ${STATUS_CLASS[e.status]}`}>{e.statusLabel}</span>
            <div className="exp-amt">{e.amount}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
