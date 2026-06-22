"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Sheet } from "@/components/ui/sheet";
import { FundForm } from "@/components/forms/fund-form";
import type { CurrencyOption } from "@/components/forms/currency-select";

export interface FundSheetHostProps {
  // create mode (no id)
  currencies: CurrencyOption[];
  // edit mode (populated when ?edit=fund:<id>)
  fundId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
}

export function FundSheetHost({
  currencies,
  fundId,
  initialValues,
}: FundSheetHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const newParam = searchParams.get("new");
  const editParam = searchParams.get("edit");

  const isCreateOpen = newParam === "fund";
  const isEditOpen = fundId != null && editParam === `fund:${fundId}`;
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
    ? t("forms.fund.title_edit")
    : t("forms.fund.title_create");

  return (
    <Sheet open={isOpen} onClose={close} ariaLabel={title} title={title}>
      <FundForm
        variant="inline"
        mode={mode}
        currencies={currencies}
        fundId={isEditOpen ? fundId : undefined}
        initialValues={isEditOpen ? initialValues : undefined}
        onSuccess={close}
      />
    </Sheet>
  );
}
