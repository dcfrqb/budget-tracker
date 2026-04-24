import { getCurrentUserId } from "@/lib/api/auth";
import { getCategories } from "@/lib/data/categories";
import { db } from "@/lib/db";
import { QuickDrawer } from "./quick-drawer";

// ─────────────────────────────────────────────────────────────
// QuickDrawerLoader — server component
// Fetches the minimum data required for all drawer forms,
// then renders the client-side QuickDrawer with props.
// Lives inside <Suspense> in RootLayout.
// ─────────────────────────────────────────────────────────────

export async function QuickDrawerLoader() {
  const userId = await getCurrentUserId();

  const [accounts, categories, currencies] = await Promise.all([
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currencyCode: true },
    }),
    getCategories(userId),
    db.currency.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <QuickDrawer
      accounts={accounts}
      categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
    />
  );
}
