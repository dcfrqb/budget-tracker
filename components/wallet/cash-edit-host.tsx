"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import { CashEditForm, type CurrencyOption } from "@/components/wallet/cash-edit-form";

export interface CashEditHostProps {
  cashId: string;
  initialLocation: string;
  initialCurrency: string;
  initialBalance: string;
  initialIncludeInAnalytics: boolean;
  currencies: CurrencyOption[];
}

export function CashEditHost({
  cashId,
  initialLocation,
  initialCurrency,
  initialBalance,
  initialIncludeInAnalytics,
  currencies,
}: CashEditHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const editParam = searchParams.get("edit");
  const isOpen = editParam === `cash:${cashId}`;

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) close(); }}
      title={t("wallet.cash.edit.title")}
      size="md"
    >
      <CashEditForm
        id={cashId}
        initialLocation={initialLocation}
        initialCurrency={initialCurrency}
        initialBalance={initialBalance}
        initialIncludeInAnalytics={initialIncludeInAnalytics}
        currencies={currencies}
        embedded
        onSuccess={close}
      />
    </Dialog>
  );
}
