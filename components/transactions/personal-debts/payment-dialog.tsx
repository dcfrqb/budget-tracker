"use client";

import React, { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { createDebtPaymentAction } from "@/app/(shell)/transactions/personal-debts/actions";
import type { AccountOption } from "@/components/forms/account-select";

interface DebtPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtId: string;
  accounts: AccountOption[];
  onDone?: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DebtPaymentDialog({
  open,
  onOpenChange,
  debtId,
  accounts,
  onDone,
}: DebtPaymentDialogProps) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !accountId) return;
    setError(null);
    startTransition(async () => {
      const result = await createDebtPaymentAction(debtId, {
        amount,
        accountId,
        occurredAt,
        note: note || undefined,
      });
      if (!result.ok) {
        setError(result.formError ?? t("forms.common.form_error.internal"));
        return;
      }
      setAmount("");
      setNote("");
      setOccurredAt(todayIso());
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("forms.personal_debt.payment_dialog.title")}
      size="sm"
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Amount */}
        <div className="field">
          <label className="form-label" htmlFor="debt-pay-amount">
            {t("forms.personal_debt.payment_dialog.field_amount")}
          </label>
          {/* TODO: migrate to MoneyInput primitive when this dialog adopts RHF */}
          <input
            id="debt-pay-amount"
            type="text"
            inputMode="decimal"
            pattern="[0-9]+([.,][0-9]+)?"
            required
            className="form-input"
            value={amount}
            onChange={(e) => {
              // Allow only digits, dot, comma; normalise comma → dot
              const raw = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
              setAmount(raw);
            }}
            onBlur={(e) => setAmount(e.target.value.trim())}
            placeholder="0.00"
          />
        </div>

        {/* Account */}
        <div className="field">
          <label className="form-label" htmlFor="debt-pay-account">
            {t("forms.personal_debt.payment_dialog.field_account")}
          </label>
          <select
            id="debt-pay-account"
            className="form-input"
            value={accountId}
            required
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">{t("forms.personal_debt.placeholder.account")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currencyCode})
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="field">
          <label className="form-label" htmlFor="debt-pay-date">
            {t("forms.personal_debt.payment_dialog.field_occurred_at")}
          </label>
          <input
            id="debt-pay-date"
            type="date"
            required
            className="form-input"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>

        {/* Note */}
        <div className="field">
          <label className="form-label" htmlFor="debt-pay-note">
            {t("forms.personal_debt.payment_dialog.field_note")}
          </label>
          <textarea
            id="debt-pay-note"
            className="form-input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div className="field-error" role="alert">{error}</div>
        )}

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("forms.common.cancel")}
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={isPending || !amount || !accountId}
          >
            {isPending ? "..." : t("forms.personal_debt.payment_dialog.submit")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
