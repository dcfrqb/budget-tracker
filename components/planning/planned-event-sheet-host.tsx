"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Sheet } from "@/components/ui/sheet";
import { PlannedEventForm } from "@/components/forms/planned-event-form";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { FundOption } from "@/components/forms/planned-event-form";

export interface PlannedEventSheetHostProps {
  currencies: CurrencyOption[];
  funds: FundOption[];
  tz?: string;
  // edit mode (populated when ?edit=event:<id>)
  eventId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
}

export function PlannedEventSheetHost({
  currencies,
  funds,
  tz,
  eventId,
  initialValues,
}: PlannedEventSheetHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const newParam = searchParams.get("new");
  const editParam = searchParams.get("edit");

  const isCreateOpen = newParam === "event";
  const isEditOpen = eventId != null && editParam === `event:${eventId}`;
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
    ? t("forms.event.title_edit")
    : t("forms.event.title_create");

  return (
    <Sheet open={isOpen} onClose={close} ariaLabel={title} title={title}>
      <PlannedEventForm
        variant="inline"
        mode={mode}
        currencies={currencies}
        funds={funds}
        tz={tz}
        eventId={isEditOpen ? eventId : undefined}
        initialValues={isEditOpen ? initialValues : undefined}
        onSuccess={close}
      />
    </Sheet>
  );
}
