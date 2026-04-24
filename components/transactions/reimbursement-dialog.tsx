"use client";

import React, { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { createReimbursementAction } from "@/app/(shell)/transactions/actions";
import type { AccountOption } from "@/components/forms/account-select";

interface ReimbursementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  accounts: AccountOption[];
  onDone?: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReimbursementDialog({
  open,
  onOpenChange,
  transactionId,
  accounts,
  onDone,
}: ReimbursementDialogProps) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayIso());
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setError(null);
    startTransition(async () => {
      const result = await createReimbursementAction(transactionId, {
        amount,
        receivedAt,
        accountId: accountId || undefined,
        note: note || undefined,
      });
      if (!result.ok) {
        setError(result.formError ?? t("forms.common.form_error.internal"));
        return;
      }
      // Reset
      setAmount("");
      setNote("");
      setAccountId("");
      setReceivedAt(todayIso());
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("forms.tx_reimburse.title")}
      size="sm"
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Amount */}
        <div className="field">
          <label className="form-label" htmlFor="reimb-amount">
            {t("forms.tx_reimburse.amount_label")}
          </label>
          <input
            id="reimb-amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="form-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Received at */}
        <div className="field">
          <label className="form-label" htmlFor="reimb-date">
            {t("forms.tx_reimburse.received_at")}
          </label>
          <input
            id="reimb-date"
            type="date"
            className="form-input"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </div>

        {/* Account */}
        {accounts.length > 0 && (
          <div className="field">
            <label className="form-label" htmlFor="reimb-account">
              {t("forms.tx_reimburse.account")}
            </label>
            <select
              id="reimb-account"
              className="form-input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">{t("forms.tx.placeholder.account")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currencyCode})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Note */}
        <div className="field">
          <label className="form-label" htmlFor="reimb-note">
            {t("forms.tx_reimburse.note")}
          </label>
          <textarea
            id="reimb-note"
            className="form-input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("forms.tx.placeholder.note")}
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
            disabled={isPending || !amount}
          >
            {t("forms.tx_reimburse.submit")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
