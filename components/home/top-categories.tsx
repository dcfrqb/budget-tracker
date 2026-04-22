import { TOP_CATEGORIES } from "@/lib/mock";

export function TopCategories() {
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>топ-категорий</b> <span className="dim">· vs март 2026</span>
        </div>
        <div className="meta mono">топ 6/18 · по убыв.</div>
      </div>
      <div className="section-body flush">
        <div className="cats-grid">
          {TOP_CATEGORIES.map((c) => (
            <div key={c.rank} className="cat-row">
              <div className="cat-rank">{c.rank}</div>
              <div className="cat-info">
                <div className="name">{c.name}</div>
                <div className="sub">{c.sub}</div>
              </div>
              <div className="cat-amt mono">{c.amount}</div>
              <div className={`cat-delta ${c.deltaDir === "up" ? "neg" : "pos"}`}>{c.delta}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
