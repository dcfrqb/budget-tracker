import Link from "next/link";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCategories } from "@/lib/data/categories";
import { getT } from "@/lib/i18n/server";
import { CategoriesManager } from "@/components/settings/categories-manager";

export const dynamic = "force-dynamic";

export default async function CategoriesSettingsPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const categories = await getCategories(userId, { includeArchived: true });

  return (
    <div className="page-content">
      <div className="page-header">
        <Link href="/settings" className="btn-ghost btn-sm">
          ← {t("forms.category.back")}
        </Link>
        <h1 className="page-title">{t("forms.category.title")}</h1>
      </div>

      <CategoriesManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          icon: c.icon ?? null,
          color: c.color ?? null,
          parentId: c.parentId ?? null,
          sortOrder: c.sortOrder,
          limitEconomy: c.limitEconomy?.toString() ?? null,
          limitNormal: c.limitNormal?.toString() ?? null,
          limitFree: c.limitFree?.toString() ?? null,
          archivedAt: c.archivedAt ?? null,
        }))}
      />
    </div>
  );
}
