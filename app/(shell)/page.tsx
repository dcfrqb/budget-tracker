import { Obligations } from "@/components/home/obligations";
import { PlanFact } from "@/components/home/plan-fact";
import { QuickActions } from "@/components/home/quick-actions";
import { Signals } from "@/components/home/signals";
import { StatusStrip } from "@/components/home/status-strip";
import { TopCategories } from "@/components/home/top-categories";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { toHomeView } from "@/lib/view/home";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCategories } from "@/lib/data/categories";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getCurrentUserId();

  const [dashboard, categories, activeAccounts] = await Promise.all([
    getHomeDashboard(userId, DEFAULT_CURRENCY),
    getCategories(userId),
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currencyCode: true },
    }),
  ]);

  const view = toHomeView(dashboard);

  // Сигналы из живых данных пока не реализованы — возвращаем пустой список.
  // TODO: добавить логику генерации сигналов когда появятся правила
  const signals: import("@/components/home/signals").SignalView[] = [];

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
      <Signals signals={signals} />
    </>
  );
}
