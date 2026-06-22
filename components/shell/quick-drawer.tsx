"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Sheet } from "@/components/ui/sheet";
import { TransactionForm } from "@/components/forms/transaction-form";
import { TransferForm } from "@/components/forms/transfer-form";
import { TransactionKind } from "@prisma/client";
import type { AccountOption } from "@/components/forms/account-select";
import type { CategoryOption } from "@/components/forms/category-select";
import type { CurrencyOption } from "@/components/forms/currency-select";

// Allowed quick-drawer slots
const QUICK_SLOTS = ["income", "expense", "transfer", "transaction"] as const;
type QuickSlot = (typeof QUICK_SLOTS)[number];

function isQuickSlot(v: string | null): v is QuickSlot {
  return QUICK_SLOTS.includes(v as QuickSlot);
}

// ─────────────────────────────────────────────────────────────
// Props — data loaded by QuickDrawerLoader (server component)
// ─────────────────────────────────────────────────────────────

export interface QuickDrawerData {
  accounts: AccountOption[];
  categories: CategoryOption[];
  currencies: CurrencyOption[];
}

interface QuickDrawerProps extends QuickDrawerData {}

export function QuickDrawer({ accounts, categories, currencies }: QuickDrawerProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const raw = searchParams.get("quick");
  const slot: QuickSlot | null = isQuickSlot(raw) ? raw : null;
  const isOpen = slot !== null;

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("quick");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router]);

  // Determine the kind for transaction forms
  let defaultKind: TransactionKind | undefined;
  if (slot === "income") defaultKind = TransactionKind.INCOME;
  else if (slot === "expense") defaultKind = TransactionKind.EXPENSE;

  return (
    <Sheet open={isOpen} onClose={close} ariaLabel={slot ?? ""}>
      {slot === "transfer" ? (
        <TransferForm
          variant="drawer"
          accounts={accounts}
          onSuccess={close}
        />
      ) : (slot === "income" || slot === "expense" || slot === "transaction") ? (
        <TransactionForm
          variant="drawer"
          mode="create"
          accounts={accounts}
          categories={categories}
          currencies={currencies}
          defaultKind={defaultKind}
          onSuccess={close}
        />
      ) : null}
    </Sheet>
  );
}
