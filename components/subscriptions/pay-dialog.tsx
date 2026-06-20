"use client";

import React, { useState, useTransition, useOptimistic } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { DEFAULT_TZ } from "@/lib/constants";
import { todayKeyInTz } from "@/lib/format/date";
import {
  paySubscriptionAction,
  markSubscriptionPaidAction,
} from "@/app/(shell)/expenses/subscriptions/actions";
import { useRouter } from "next/navigation";

export type PayDialogProps = {
  subscriptionId: string;
  subscriptionName: string;
  subscriptionAmount: string;
  billingIntervalMonths: number;
  currentNextPaymentDate: string; // ISO date string
  accountId?: string;
  onPaid?: (newNextPaymentDate: string) => void;
  tz?: string;
  /** Whether to default to link mode (sub has prior charges or keywords) */
  preferLinkMode?: boolean;
  /** Recent unlinked expense candidates for link mode */
  recentExpenses?: RecentExpenseOption[];
};

export type RecentExpenseOption = {
  id: string;
  name: string;
  amount: string;
  currencyCode: string;
  occurredAtFormatted: string;
  accountName: string | null;
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
  tz,
  preferLinkMode = false,
  recentExpenses = [],
}: PayDialogProps) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"link" | "manual">(
    preferLinkMode && recentExpenses.length > 0 ? "link" : "manual",
  );
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);

  const [optimisticDate, addOptimistic] = useOptimistic(
    currentNextPaymentDate,
    (_state: string, newDate: string) => newDate,
  );

  const nextDate = shiftDateByMonths(optimisticDate, billingIntervalMonths);

  function handlePayManual() {
    setError(null);
    const newDate = shiftDateByMonths(optimisticDate, billingIntervalMonths);
    startTransition(async () => {
      addOptimistic(newDate);
      const result = await paySubscriptionAction(subscriptionId, {
        accountId: accountId ?? null,
        paidAt: todayKeyInTz(tz ?? DEFAULT_TZ),
      });
      if (!result.ok) {
        setError(result.formError ?? t("forms.common.form_error.internal"));
        return;
      }
      setOpen(false);
      onPaid?.(newDate);
    });
  }

  function handlePayLink() {
    if (!selectedTxnId) return;
    setError(null);
    startTransition(async () => {
      const result = await markSubscriptionPaidAction({
        subscriptionId,
        transactionId: selectedTxnId,
      });
      if (!result.ok) {
        setError(result.formError ?? t("forms.common.form_error.internal"));
        return;
      }
      setOpen(false);
      router.refresh();
      onPaid?.(nextDate);
    });
  }

  const bodyText = t("forms.sub.pay_confirm_body", {
    vars: {
      name: subscriptionName,
      amount: subscriptionAmount,
      n: String(billingIntervalMonths),
    },
  });

  function handleOpen() {
    // Reset to preferred mode on each open
    setMode(preferLinkMode && recentExpenses.length > 0 ? "link" : "manual");
    setSelectedTxnId(null);
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ flex: 1 }}
        onClick={handleOpen}
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
            {mode === "manual" ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handlePayManual}
                disabled={isPending}
              >
                {isPending ? "..." : t("buttons.pay")}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handlePayLink}
                disabled={isPending || !selectedTxnId}
              >
                {isPending ? "..." : t("expenses.subscriptions.pay.link_confirm")}
              </button>
            )}
          </div>
        }
      >
        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            className={mode === "link" ? "btn-primary" : "btn"}
            style={{ fontSize: "var(--text-xs)", padding: "3px 10px" }}
            onClick={() => setMode("link")}
          >
            {t("expenses.subscriptions.pay.mode_link")}
          </button>
          <button
            type="button"
            className={mode === "manual" ? "btn-primary" : "btn"}
            style={{ fontSize: "var(--text-xs)", padding: "3px 10px" }}
            onClick={() => setMode("manual")}
          >
            {t("expenses.subscriptions.pay.mode_manual")}
          </button>
        </div>

        {mode === "manual" && (
          <>
            <p className="mono" style={{ fontSize: "var(--text-md)", color: "var(--text)" }}>
              {bodyText}
            </p>
            <p className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 8 }}>
              {nextDate}
            </p>
          </>
        )}

        {mode === "link" && (
          <div>
            <p className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: 10 }}>
              {t("expenses.subscriptions.pay.link_title")}
            </p>
            {recentExpenses.length === 0 ? (
              <p className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
                {t("expenses.subscriptions.pay.link_empty")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto" }}>
                {recentExpenses.map((exp) => (
                  <label
                    key={exp.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 0",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="link-txn"
                      value={exp.id}
                      checked={selectedTxnId === exp.id}
                      onChange={() => setSelectedTxnId(exp.id)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="mono"
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {exp.name}
                      </div>
                      <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 2 }}>
                        {exp.amount} {exp.currencyCode} · {exp.occurredAtFormatted}
                        {exp.accountName && ` · ${exp.accountName}`}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
      </Dialog>
    </>
  );
}
