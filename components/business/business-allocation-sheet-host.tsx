"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Sheet } from "@/components/ui/sheet";
import { AllocationSplitEditor } from "@/components/business/allocation-split-editor";
import { OffAppRevenueForm } from "@/components/business/offapp-revenue-form";
import type { CurrencyOption } from "@/components/forms/currency-select";

export interface SplitTxnData {
  id: string;
  amount: string;
  currencyCode: string;
}

export interface BusinessAllocationSheetHostProps {
  businessId: string;
  businessCurrencyCode: string;
  currencies: CurrencyOption[];
  splitTxn?: SplitTxnData;
}

export function BusinessAllocationSheetHost({
  businessId,
  businessCurrencyCode,
  currencies,
  splitTxn,
}: BusinessAllocationSheetHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const newParam = searchParams.get("new");
  const splitParam = searchParams.get("split");

  const isOffAppOpen = newParam === "offapp";
  const isSplitOpen = splitTxn != null && splitParam === splitTxn.id;

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("split");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  return (
    <>
      <Sheet
        open={isOffAppOpen}
        onClose={close}
        ariaLabel={t("business.allocation.offapp.title")}
        title={t("business.allocation.offapp.title")}
      >
        <OffAppRevenueForm
          businessId={businessId}
          currencyCode={businessCurrencyCode}
          currencies={currencies}
          onSuccess={close}
        />
      </Sheet>

      <Sheet
        open={isSplitOpen}
        onClose={close}
        ariaLabel={t("business.allocation.split.title")}
        title={t("business.allocation.split.title")}
      >
        {splitTxn && (
          <AllocationSplitEditor
            businessId={businessId}
            transactionId={splitTxn.id}
            transactionAmount={splitTxn.amount}
            currencyCode={splitTxn.currencyCode}
            onSuccess={close}
          />
        )}
      </Sheet>
    </>
  );
}
