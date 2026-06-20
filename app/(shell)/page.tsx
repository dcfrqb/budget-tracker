import { Obligations } from "@/components/home/obligations";
import { PlanFact } from "@/components/home/plan-fact";
import { QuickActions } from "@/components/home/quick-actions";
import { StatusStrip } from "@/components/home/status-strip";
import { TopCategories } from "@/components/home/top-categories";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { toHomeView } from "@/lib/view/home";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCategories } from "@/lib/data/categories";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getCurrentUserId();

  const [dashboard, categories, activeAccounts, t, tz] = await Promise.all([
    getHomeDashboard(userId, DEFAULT_CURRENCY),
    getCategories(userId),
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currencyCode: true },
    }),
    getT(),
    getCurrentUserTz(),
  ]);

  const view = toHomeView(dashboard, t, tz);

  // First non-archived account as default for quick input
  const defaultAccount = activeAccounts[0];

  return (
    <>
      <StatusStrip />
      <QuickActions
        defaultAccountId={defaultAccount?.id}
        defaultCurrency={defaultAccount?.currencyCode ?? DEFAULT_CURRENCY}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind as "INCOME" | "EXPENSE",
        }))}
        accountName={defaultAccount?.name}
      />
      <PlanFact cells={view.planFact} />
      <Obligations obligations={view.obligations} />
      <TopCategories categories={view.topCategories} />
    </>
  );
}
