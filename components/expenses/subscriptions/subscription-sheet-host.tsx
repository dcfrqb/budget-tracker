"use client";

import React, { useCallback } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Sheet } from "@/components/ui/sheet";
import { SubscriptionForm } from "@/components/forms/subscription-form";
import { SharesEditor } from "@/components/subscriptions/shares-editor";
import { PaymentHistory } from "@/components/subscriptions/payment-history";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { ShareItem } from "@/components/subscriptions/shares-editor";
import type { ChargeRow } from "@/components/subscriptions/payment-history";

export interface SubscriptionSheetHostProps {
  currencies: CurrencyOption[];
  tz?: string;
  // create mode: no extra props needed
  // edit mode: populated when ?edit=sub:<id>
  subscriptionId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValues?: Record<string, any>;
  initialShares?: ShareItem[];
  charges?: ChargeRow[];
  isSplit?: boolean;
  matchKeywords?: string[];
}

export function SubscriptionSheetHost({
  currencies,
  tz,
  subscriptionId,
  initialValues,
  initialShares,
  charges,
  isSplit,
  matchKeywords,
}: SubscriptionSheetHostProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const newParam = searchParams.get("new");
  const editParam = searchParams.get("edit");

  const isCreateOpen = newParam === "sub";
  const isEditOpen =
    subscriptionId != null && editParam === `sub:${subscriptionId}`;
  const isOpen = isCreateOpen || isEditOpen;

  const mode = isEditOpen ? "edit" : "create";

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (isCreateOpen) params.delete("new");
    if (isEditOpen) params.delete("edit");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, isCreateOpen, isEditOpen]);

  const title =
    mode === "edit"
      ? t("forms.sub.title_edit")
      : t("forms.sub.title_create");

  return (
    <Sheet open={isOpen} onClose={close} ariaLabel={title} title={title}>
      <SubscriptionForm
        variant="inline"
        mode={mode}
        currencies={currencies}
        subscriptionId={isEditOpen ? subscriptionId : undefined}
        initialValues={initialValues}
        tz={tz}
        matchKeywords={matchKeywords}
        onSuccess={close}
      />

      {isEditOpen && isSplit && subscriptionId && (
        <div className="section" style={{ marginTop: "var(--space-6)" }}>
          <div className="section-hd">
            <div className="ttl mono">
              <b>{t("forms.sub.shares_editor.title")}</b>
            </div>
          </div>
          <div className="section-body">
            <SharesEditor
              subscriptionId={subscriptionId}
              initialShares={initialShares ?? []}
              isSplit={true}
            />
          </div>
        </div>
      )}

      {isEditOpen && charges && charges.length > 0 && (
        <div className="section" style={{ marginTop: "var(--space-6)" }}>
          <div className="section-hd">
            <div className="ttl mono">
              <b>{t("expenses.subscriptions.history.title")}</b>
            </div>
          </div>
          <div className="section-body">
            <PaymentHistory charges={charges} />
          </div>
        </div>
      )}
    </Sheet>
  );
}
