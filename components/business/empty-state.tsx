import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export async function BusinessEmptyState() {
  const t = await getT();

  return (
    <div className="ws-grid">
      <article className="ws-card add" tabIndex={0} style={{ gridColumn: "1 / -1" }}>
        <div style={{ textAlign: "center" }}>
          <div className="plus">+</div>
          <div className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginBottom: 8 }}>
            {t("business.index.empty")}
          </div>
          <Link href="/business/new" className="btn primary btn-sm">
            {t("business.index.add")}
          </Link>
        </div>
      </article>
    </div>
  );
}
