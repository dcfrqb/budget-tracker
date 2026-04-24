"use client";

import React, { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { confirmTransactionAction } from "@/app/(shell)/transactions/actions";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  /** Remaining amount to be confirmed (as formatted string, for display) */
  remainingAmount?: string;
  /** Remaining amount as numeric string for default value */
  remainingAmountRaw?: string;
  onDone?: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ConfirmDialog({
  open,
  onOpenChange,
  transactionId,
  remainingAmount,
  remainingAmountRaw,
  onDone,
}: ConfirmDialogProps) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(remainingAmountRaw ?? "");
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleFullyConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmTransactionAction(transactionId, {
        occurredAt,
        note: note || undefined,
        // No amount = full remaining
      });
      if (!result.ok) {
        setError(result.formError ?? t("forms.common.form_error.internal"));
        return;
      }
      onOpenChange(false);
      onDone?.();
    });
  }

  function handlePartialConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await confirmTransactionAction(transactionId, {
        amount: amount || undefined,
        occurredAt,
        note: note || undefined,
      });
      if (!result.ok) {
        setError(result.formError ?? t("forms.common.form_error.internal"));
        return;
      }
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("forms.tx_confirm.title")}
      size="sm"
      footer={
        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
          <button
            type="button"
            className="btn"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("forms.common.cancel")}
          </button>
          <button
            type="button"
            className="btn primary"
            style={{ marginLeft: "auto" }}
            onClick={handleFullyConfirm}
            disabled={isPending}
          >
            {t("forms.tx_confirm.fully")}
          </button>
        </div>
      }
    >
      <form onSubmit={handlePartialConfirm} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Amount */}
        <div className="field">
          <label className="form-label" htmlFor="confirm-amount">
            {t("forms.tx_confirm.amount_label")}
            {remainingAmount && (
              <span className="form-label-hint"> ({t("forms.tx_confirm.partial")}: {remainingAmount})</span>
            )}
          </label>
          <input
            id="confirm-amount"
            type="number"
            step="0.01"
            min="0.01"
            className="form-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={remainingAmountRaw ?? ""}
          />
        </div>

        {/* Date */}
        <div className="field">
          <label className="form-label" htmlFor="confirm-date">
            {t("forms.tx_confirm.date_label")}
          </label>
          <input
            id="confirm-date"
            type="date"
            className="form-input"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>

        {/* Note */}
        <div className="field">
          <label className="form-label" htmlFor="confirm-note">
            {t("forms.tx_confirm.note_label")}
          </label>
          <textarea
            id="confirm-note"
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

        <button
          type="submit"
          className="btn primary"
          disabled={isPending || !amount}
        >
          {t("forms.tx_confirm.submit")}
        </button>
      </form>
    </Dialog>
  );
}
