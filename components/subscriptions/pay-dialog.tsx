"use client";

import React, { useState, useTransition, useOptimistic } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { paySubscriptionAction } from "@/app/(shell)/expenses/subscriptions/actions";

export type PayDialogProps = {
  subscriptionId: string;
  subscriptionName: string;
  subscriptionAmount: string;
  billingIntervalMonths: number;
  currentNextPaymentDate: string; // ISO date string
  accountId?: string;
  onPaid?: (newNextPaymentDate: string) => void;
};

function shiftDateByMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function PayDialog({
  subscriptionId,
  subscriptionName,
  subscriptionAmount,
  billingIntervalMonths,
  currentNextPaymentDate,
  accountId,
  onPaid,
}: PayDialogProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Optimistic: track next payment date locally
  const [optimisticDate, addOptimistic] = useOptimistic(
    currentNextPaymentDate,
    (_state: string, newDate: string) => newDate,
  );

  const nextDate = shiftDateByMonths(optimisticDate, billingIntervalMonths);

  function handlePay() {
    setError(null);
    const newDate = shiftDateByMonths(optimisticDate, billingIntervalMonths);
    startTransition(async () => {
      addOptimistic(newDate);
      const result = await paySubscriptionAction(subscriptionId, {
        accountId: accountId ?? null,
        paidAt: new Date().toISOString().slice(0, 10),
      });
      if (!result.ok) {
        setError(result.formError ?? t("forms.common.form_error.internal"));
        return;
      }
      setOpen(false);
      onPaid?.(newDate);
    });
  }

  const bodyText = t("forms.sub.pay_confirm_body", {
    vars: {
      name: subscriptionName,
      amount: subscriptionAmount,
      n: String(billingIntervalMonths),
    },
  });

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ flex: 1 }}
        onClick={() => setOpen(true)}
      >
        {t("forms.sub.pay_button")}
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("forms.sub.pay_confirm_title")}
        size="sm"
        footer={
          <div className="submit-row-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {t("forms.common.cancel")}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handlePay}
              disabled={isPending}
            >
              {isPending ? "..." : t("buttons.pay")}
            </button>
          </div>
        }
      >
        <p className="mono" style={{ fontSize: 13, color: "var(--text)" }}>
          {bodyText}
        </p>
        <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          {nextDate}
        </p>
        {error && <p className="field-error">{error}</p>}
      </Dialog>
    </>
  );
}
