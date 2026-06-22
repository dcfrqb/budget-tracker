"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Sheet } from "@/components/ui/sheet";
import { AccountForm } from "@/components/forms/account-form";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { InstitutionOption } from "@/components/forms/account-form";

export interface AccountSheetHostProps {
  currencies: CurrencyOption[];
  institutions: InstitutionOption[];
  primaryCurrency: string;
  // edit mode (populated when ?edit=account:<id>)
  accountId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
}

export function AccountSheetHost({
  currencies,
  institutions,
  primaryCurrency,
  accountId,
  initialValues,
}: AccountSheetHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const newParam = searchParams.get("new");
  const editParam = searchParams.get("edit");

  const isCreateOpen = newParam === "account";
  const isEditOpen = accountId != null && editParam === `account:${accountId}`;
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
    ? t("forms.account.title_edit")
    : t("forms.account.title_create");

  const createInitialValues = isCreateOpen
    ? { currencyCode: primaryCurrency, ...initialValues }
    : initialValues;

  return (
    <Sheet open={isOpen} onClose={close} ariaLabel={title} title={title}>
      <AccountForm
        variant="inline"
        mode={mode}
        currencies={currencies}
        institutions={institutions}
        accountId={isEditOpen ? accountId : undefined}
        initialValues={isEditOpen ? initialValues : createInitialValues}
        onSuccess={close}
      />
    </Sheet>
  );
}
