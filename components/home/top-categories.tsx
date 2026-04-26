import { getT } from "@/lib/i18n/server";
import type { HomeTopCategoryView } from "@/lib/view/home";

export async function TopCategories({ categories }: { categories: HomeTopCategoryView[] }) {
  const t = await getT();
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("home.top_categories.title")}</b>{" "}
          <span className="dim">· {t("home.top_categories.delta_label")}</span>
        </div>
        <div className="meta mono">{t("home.top_categories.meta", { vars: { count: categories.length } })}</div>
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
              <div className={`cat-delta ${c.deltaDir === "up" ? "neg" : c.deltaDir === "down" ? "pos" : c.deltaDir === "new" ? "info" : "mut"}`}>
                {c.deltaDir === "new" ? t("home.top_categories.delta_new") : c.delta}
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              {t("home.top_categories.empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
