import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { BusinessCardsGrid } from "./business-card";
import { BusinessEmptyState } from "./empty-state";
import type { BusinessCardSummary } from "@/lib/data/businesses";

interface BusinessesSectionProps {
  items: BusinessCardSummary[];
}

export async function BusinessesSection({ items }: BusinessesSectionProps) {
  const t = await getT();

  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("business.index.section_title")}</b>
          <span className="dim"> · {items.length}</span>
        </div>
        {items.length > 0 && (
          <div className="meta mono">
            <Link href="/business/new" className="btn primary btn-xs">
              {t("business.index.add")}
            </Link>
          </div>
        )}
      </div>
      <div className="section-body flush">
        {items.length === 0 ? <BusinessEmptyState /> : <BusinessCardsGrid items={items} />}
      </div>
    </div>
  );
}
