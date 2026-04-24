export type ExpectedRow = {
  id: string;
  date: string;
  weekday: string;
  inDays: string;
  name: string;
  sub: string;
  src: string;
  status: "confirmed" | "expected" | "await";
  statusLabel: string;
  amount: string;
};

const STATUS_CLASS = { confirmed: "st-confirmed", expected: "st-expected", await: "st-await" } as const;

export function ExpectedIncome({ rows }: { rows: ExpectedRow[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>ожидаемые поступления</b> <span className="dim">· ближ. 90д</span>
        </div>
        <div className="meta mono">{rows.length} событий</div>
      </div>
      <div className="section-body flush">
        {rows.map((e) => (
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
        {rows.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет запланированных поступлений
          </div>
        )}
      </div>
    </div>
  );
}
