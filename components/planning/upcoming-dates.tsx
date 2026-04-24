export type UpcomingDateItem = {
  id: string;
  day: string;
  mo: string;
  n: string;
  m: string;
  amount: string;
};

export function UpcomingDates({ items }: { items: UpcomingDateItem[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "360ms", marginBottom: 0 }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>ближайшие даты</b> <span className="dim">· автопредложение отложить</span>
        </div>
        <div className="meta mono">{items.length} событий</div>
      </div>
      <div className="bh-row">
        {items.map((b) => (
          <div key={b.id} className="bh-pill">
            <div className="bh-date">{b.day}<b>{b.mo}</b></div>
            <div className="bh-info">
              <div className="n">{b.n}</div>
              <div className="m">{b.m}</div>
            </div>
            <span className="bh-amt">{b.amount}</span>
          </div>
        ))}
        {items.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет ближайших событий
          </div>
        )}
      </div>
    </div>
  );
}
