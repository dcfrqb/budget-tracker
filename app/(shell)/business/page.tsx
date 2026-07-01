import { getCurrentUserId } from "@/lib/api/auth";
import { getT } from "@/lib/i18n/server";
import { getBusinessCardSummaries, getActiveBusinesses } from "@/lib/data/businesses";
import { BusinessesSection } from "@/components/business/businesses-section";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const userId = await getCurrentUserId();

  const [t, summaries, activeBusinesses] = await Promise.all([
    getT(),
    getBusinessCardSummaries(userId),
    getActiveBusinesses(userId),
  ]);

  return (
    <>
      <div className="section fade-in" style={{ animationDelay: "0ms" }}>
        <div className="section-hd">
          <div className="ttl mono">
            <b>{t("business.index.title")}</b>
          </div>
          <div className="meta mono">{activeBusinesses.length}</div>
        </div>
      </div>
      <BusinessesSection items={summaries} />
    </>
  );
}
