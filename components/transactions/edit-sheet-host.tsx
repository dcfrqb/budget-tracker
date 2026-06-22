"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Sheet } from "@/components/ui/sheet";
import { TransactionForm } from "@/components/forms/transaction-form";
import { TransferForm } from "@/components/forms/transfer-form";
import type { AccountOption } from "@/components/forms/account-select";
import type { CategoryOption } from "@/components/forms/category-select";
import type { CurrencyOption } from "@/components/forms/currency-select";

export interface EditSheetHostProps {
  kind: "txn" | "transfer";
  entityId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues: Record<string, any>;
  accounts: AccountOption[];
  categories: CategoryOption[];
  currencies: CurrencyOption[];
  workSources?: { id: string; name: string }[];
  tz?: string;
}

export function EditSheetHost({
  kind,
  entityId,
  initialValues,
  accounts,
  categories,
  currencies,
  workSources,
  tz,
}: EditSheetHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const editParam = searchParams.get("edit");
  const isOpen = editParam !== null && editParam === `${kind}:${entityId}`;

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const ariaLabel = kind === "txn"
    ? t("transactions.edit_sheet.title_txn")
    : t("transactions.edit_sheet.title_transfer");

  return (
    <Sheet open={isOpen} onClose={close} ariaLabel={ariaLabel} title={ariaLabel}>
      {kind === "txn" ? (
        <TransactionForm
          variant="drawer"
          mode="edit"
          transactionId={entityId}
          accounts={accounts}
          categories={categories}
          currencies={currencies}
          workSources={workSources}
          initialValues={initialValues}
          tz={tz}
          onSuccess={close}
        />
      ) : (
        <TransferForm
          variant="drawer"
          mode="edit"
          transferId={entityId}
          accounts={accounts}
          initialValues={initialValues}
          tz={tz}
          onSuccess={close}
        />
      )}
    </Sheet>
  );
}
