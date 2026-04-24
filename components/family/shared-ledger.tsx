export type SharedTxnRow = {
  id: string;
  kind: string;
  date: string;
  weekday: string;
  name: string;
  sub: string;
  paid: string;
  split: string;
  splitPer: string;
  cat: string;
  amount: string;
};

export function SharedLedger({ rows, totalCount }: { rows: SharedTxnRow[]; totalCount?: number }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "280ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>общие транзакции</b>{" "}
          <span className="dim">· текущий месяц · {totalCount ?? rows.length} штук</span>
        </div>
        <div className="meta mono">разделение авто · равное, если не указано</div>
      </div>
      <div className="section-body flush">
        {rows.map((t) => (
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
        {rows.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет общих транзакций
          </div>
        )}
      </div>
    </div>
  );
}
