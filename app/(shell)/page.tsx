import { Obligations } from "@/components/home/obligations";
import { PlanFact } from "@/components/home/plan-fact";
import { QuickActions } from "@/components/home/quick-actions";
import { StatusStrip } from "@/components/home/status-strip";
import { TopCategories } from "@/components/home/top-categories";
import { Signals } from "@/components/home/signals";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { toHomeView, rawSignalsToViews } from "@/lib/view/home";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCategories } from "@/lib/data/categories";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import {
  getShrinkableCategories,
  getObligatoryDiscretionarySplit,
  getEconomyExitScenario,
} from "@/lib/data/analytics-prescriptive";
import { getDismissedSignals, computeSignals } from "@/lib/data/signals";
import { getBudgetSettings } from "@/lib/data/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getCurrentUserId();
  const now = new Date();

  const currentMonthRange = {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    to: now,
  };

  const [tz, t] = await Promise.all([
    getCurrentUserTz(),
    getT(),
  ]);

  const [dashboard, categories, activeAccounts, shrinkable, discretionary, economyExit, dismissedSet, budgetSettings] = await Promise.all([
    getHomeDashboard(userId, DEFAULT_CURRENCY),
    getCategories(userId),
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currencyCode: true },
    }),
    getShrinkableCategories(userId, DEFAULT_CURRENCY, tz, now),
    getObligatoryDiscretionarySplit(userId, currentMonthRange, DEFAULT_CURRENCY),
    getEconomyExitScenario(userId, DEFAULT_CURRENCY, tz, now),
    getDismissedSignals(userId),
    getBudgetSettings(userId),
  ]);

  const rawSignals = computeSignals({
    dashboard,
    shrinkable,
    discretionary,
    economyExit,
    baseCcy: DEFAULT_CURRENCY,
  });

  const top5 = rawSignals
    .filter((s) => !dismissedSet.has(s.key))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  const signalViews = rawSignalsToViews(top5, t);

  const view = toHomeView(dashboard, t, tz, signalViews);

  // First non-archived account as default for quick input
  const defaultAccount = activeAccounts[0];

  return (
    <>
      <StatusStrip activeMode={budgetSettings?.activeMode ?? "NORMAL"} />
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
      <Signals signals={view.signals} />
      <PlanFact cells={view.planFact} />
      <Obligations obligations={view.obligations} />
      <TopCategories categories={view.topCategories} />
    </>
  );
}
