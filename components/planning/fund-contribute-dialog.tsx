"use client";

import React, { useState, useTransition, useOptimistic } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { contributeFundAction } from "@/app/(shell)/planning/funds/actions";
import type { AccountOption } from "@/components/forms/account-select";

export type FundContributeDialogProps = {
  fundId: string;
  fundName: string;
  fundCurrencyCode: string;
  currentAmount: string; // numeric string
  accounts: AccountOption[];
  defaultAccountId?: string;
  onContributed?: (newCurrentAmount: string) => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FundContributeDialog({
  fundId,
  fundName,
  fundCurrencyCode,
  currentAmount,
  accounts,
  defaultAccountId,
  onContributed,
}: FundContributeDialogProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Optimistic: track current amount locally
  const [optimisticAmount, addOptimistic] = useOptimistic(
    currentAmount,
    (_state: string, newAmount: string) => newAmount,
  );

  function handleSubmit() {
    setFormError(null);
    setFieldErrors({});
    startTransition(async () => {
      // Compute optimistic new amount
      const currentNum = parseFloat(optimisticAmount) || 0;
      const addNum = parseFloat(amount) || 0;
      const newAmountStr = (currentNum + addNum).toFixed(2);
      addOptimistic(newAmountStr);

      const result = await contributeFundAction(fundId, {
        amount,
        currencyCode: fundCurrencyCode,
        accountId,
        occurredAt,
      });
      if (!result.ok) {
        if (result.fieldErrors) {
          const errs: Record<string, string> = {};
          for (const [k, v] of Object.entries(result.fieldErrors)) {
            errs[k] = v[0] ?? "";
          }
          setFieldErrors(errs);
        }
        if (result.formError) {
          setFormError(
            result.formError === "not_found"
              ? t("forms.common.form_error.not_found")
              : result.formError === "conflict"
              ? t("forms.common.form_error.conflict")
              : t("forms.common.form_error.internal"),
          );
        }
        return;
      }
      setOpen(false);
      setAmount("");
      setNote("");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = result.data as any;
      onContributed?.(data?.fund?.currentAmount ? String(data.fund.currentAmount) : newAmountStr);
    });
  }

  return (
    <>
      {/* Display optimistic amount as data attribute for parent */}
      <button
        type="button"
        className="btn"
        style={{ fontSize: 11 }}
        onClick={() => setOpen(true)}
        data-current-amount={optimisticAmount}
      >
        {t("buttons.contribute")}
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("forms.fund.contribute_dialog.title")}
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
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? "..." : t("forms.fund.contribute_dialog.submit")}
            </button>
          </div>
        }
      >
        <div className="form-grid" style={{ gap: "var(--space-4)" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{fundName}</div>

          {/* Amount */}
          <div className="field">
            <label className="field-label">{t("forms.fund.contribute_dialog.field_amount")}</label>
            <div className="money-input-wrap">
              <input
                type="text"
                inputMode="decimal"
                className="money-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <span className="money-input-currency">{fundCurrencyCode}</span>
            </div>
            {fieldErrors.amount && <span className="field-error">{fieldErrors.amount}</span>}
          </div>

          {/* Account */}
          {accounts.length > 0 && (
            <div className="field">
              <label className="field-label">{t("forms.fund.contribute_dialog.field_account")}</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {fieldErrors.accountId && <span className="field-error">{fieldErrors.accountId}</span>}
            </div>
          )}

          {/* Date */}
          <div className="field">
            <label className="field-label">{t("forms.fund.contribute_dialog.field_date")}</label>
            <input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="field">
            <label className="field-label">{t("forms.fund.contribute_dialog.field_note")}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {formError && <span className="field-error">{formError}</span>}
        </div>
      </Dialog>
    </>
  );
}
