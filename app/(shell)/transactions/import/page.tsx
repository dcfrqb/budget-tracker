import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT, getLocale } from "@/lib/i18n/server";
import { ImportWizard } from "@/components/transactions/import/import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [userId, t, locale] = await Promise.all([
    getCurrentUserId(),
    getT(),
    getLocale(),
  ]);

  const [accounts, categories] = await Promise.all([
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currencyCode: true },
    }),
    db.category.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
  ]);

  return (
    <div className="feed">
      <div className="section fade-in">
        <div className="section-hd">
          <span className="ttl">{t("import.title")}</span>
        </div>
        <div className="section-body">
          <ImportWizard
            accounts={accounts}
            categories={categories.map((c) => ({ ...c, kind: c.kind as string }))}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
