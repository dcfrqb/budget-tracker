"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Sheet } from "@/components/ui/sheet";
import { PersonalDebtForm } from "@/components/forms/personal-debt-form";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { AccountOption } from "@/components/forms/account-select";

export interface PersonalDebtSheetHostProps {
  currencies: CurrencyOption[];
  accounts: AccountOption[];
  tz?: string;
  // edit mode (populated when ?edit=debt:<id>)
  debtId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
}

export function PersonalDebtSheetHost({
  currencies,
  accounts,
  tz,
  debtId,
  initialValues,
}: PersonalDebtSheetHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const newParam = searchParams.get("new");
  const editParam = searchParams.get("edit");

  const isCreateOpen = newParam === "debt";
  const isEditOpen = debtId != null && editParam === `debt:${debtId}`;
  const isOpen = isCreateOpen || isEditOpen;

  const mode = isEditOpen ? "edit" : "create";

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (isCreateOpen) params.delete("new");
    if (isEditOpen) params.delete("edit");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, isCreateOpen, isEditOpen]);

  const title = mode === "edit"
    ? t("forms.personal_debt.title_edit")
    : t("forms.personal_debt.title_create");

  return (
    <Sheet open={isOpen} onClose={close} ariaLabel={title} title={title}>
      <PersonalDebtForm
        variant="inline"
        mode={mode}
        currencies={currencies}
        accounts={accounts}
        tz={tz}
        debtId={isEditOpen ? debtId : undefined}
        initialValues={isEditOpen ? initialValues : undefined}
        onSuccess={close}
      />
    </Sheet>
  );
}
