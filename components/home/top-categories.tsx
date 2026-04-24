import type { HomeTopCategoryView } from "@/lib/view/home";

export function TopCategories({ categories }: { categories: HomeTopCategoryView[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>топ-категорий</b> <span className="dim">· vs прош. месяц</span>
        </div>
        <div className="meta mono">топ {categories.length} · по убыв.</div>
      </div>
      <div className="section-body flush">
        <div className="cats-grid">
          {categories.map((c) => (
            <div key={c.rank} className="cat-row">
              <div className="cat-rank">{c.rank}</div>
              <div className="cat-info">
                <div className="name">{c.name}</div>
                <div className="sub">{c.sub}</div>
              </div>
              <div className="cat-amt mono">{c.amount}</div>
              <div className={`cat-delta ${c.deltaDir === "up" ? "neg" : c.deltaDir === "down" ? "pos" : "mut"}`}>{c.delta}</div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              нет данных о расходах по категориям
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
