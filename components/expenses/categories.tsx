export type ExpenseCategoryView = {
  id: string;
  name: string;
  sub: string;
  amount: string;
  amountTone?: "info";
  pct: number;
  barColor: string;
  usageLabel: string;
  total: string;
};

export function ExpenseCategories({ categories }: { categories: ExpenseCategoryView[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>категории</b> <span className="dim">· текущий месяц</span>
        </div>
        <div className="meta mono">по сумме</div>
      </div>
      <div className="section-body flush">
        <div className="cat-grid">
          {categories.map((c) => (
            <div key={c.id} className="cat-card" tabIndex={0}>
              <div className="cat-top">
                <div>
                  <div className="cat-name">{c.name}</div>
                  <div className="cat-sub">{c.sub}</div>
                </div>
                <div className={`cat-amt ${c.amountTone ?? ""}`}>{c.amount}</div>
              </div>
              <div className="cat-bar">
                <div className="fill" style={{ width: `${c.pct}%`, background: c.barColor }} />
              </div>
              <div className="cat-foot">
                <span>{c.usageLabel}</span>
                <span>{c.total}</span>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              нет данных по категориям
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
