import { EXPENSE_CATEGORIES } from "@/lib/mock-expenses";

export function ExpenseCategories() {
  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>категории</b> <span className="dim">· дом, авто, ЖКХ</span>
        </div>
        <div className="meta mono">ср 3мес</div>
      </div>
      <div className="section-body flush">
        <div className="cat-grid">
          {EXPENSE_CATEGORIES.map((c) => (
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
        </div>
      </div>
    </div>
  );
}
