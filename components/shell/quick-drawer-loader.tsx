import { getCurrentUserId } from "@/lib/api/auth";
import { getCategories } from "@/lib/data/categories";
import { listAccountsForQuickDrawer } from "@/lib/data/wallet";
import { listAllCurrencies } from "@/lib/data/currencies";
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
    listAccountsForQuickDrawer(userId),
    getCategories(userId),
    listAllCurrencies(),
  ]);

  return (
    <QuickDrawer
      accounts={accounts}
      categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
    />
  );
}
