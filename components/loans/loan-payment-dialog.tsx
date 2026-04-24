"use client";

import React, { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { createLoanPaymentAction } from "@/app/(shell)/expenses/loans/actions";
import type { AccountOption } from "@/components/forms/account-select";

export type DefaultSplit = {
  principalPart: string;
  interestPart: string;
  payment: string;
};

export type LoanPaymentDialogProps = {
  loanId: string;
  loanName: string;
  defaultSplit?: DefaultSplit;
  accounts: AccountOption[];
  defaultAccountId?: string;
  onPaid?: () => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

export function LoanPaymentDialog({
  loanId,
  loanName,
  defaultSplit,
  accounts,
  defaultAccountId,
  onPaid,
}: LoanPaymentDialogProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [paidAt, setPaidAt] = useState(todayIso());
  const [totalAmount, setTotalAmount] = useState(defaultSplit?.payment ?? "");
  const [principalPart, setPrincipalPart] = useState(defaultSplit?.principalPart ?? "");
  const [interestPart, setInterestPart] = useState(defaultSplit?.interestPart ?? "");
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleAutoFill() {
    if (defaultSplit) {
      setTotalAmount(defaultSplit.payment);
      setPrincipalPart(defaultSplit.principalPart);
      setInterestPart(defaultSplit.interestPart);
    }
  }

  function handleSubmit() {
    setFormError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createLoanPaymentAction(loanId, {
        paidAt,
        totalAmount,
        principalPart: principalPart || null,
        interestPart: interestPart || null,
        accountId: accountId || null,
        note: note || null,
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
      onPaid?.();
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn primary"
        style={{ padding: "3px 9px", fontSize: 10 }}
        onClick={() => setOpen(true)}
      >
        {t("buttons.add_payment")}
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("forms.loan.payment_dialog.title")}
        size="md"
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
              {isPending ? "..." : t("forms.loan.payment_dialog.submit")}
            </button>
          </div>
        }
      >
        <div className="form-grid" style={{ gap: "var(--space-4)" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{loanName}</div>

          {/* Auto fill button */}
          {defaultSplit && (
            <button
              type="button"
              className="btn"
              style={{ fontSize: 11 }}
              onClick={handleAutoFill}
            >
              {t("forms.loan.payment_dialog.auto_split")}
            </button>
          )}

          {/* Paid at */}
          <div className="field">
            <label className="field-label">{t("forms.loan.payment_dialog.field_paid_at")}</label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
            {fieldErrors.paidAt && <span className="field-error">{fieldErrors.paidAt}</span>}
          </div>

          {/* Total amount */}
          <div className="field">
            <label className="field-label">{t("forms.loan.payment_dialog.field_total")}</label>
            <input
              type="text"
              inputMode="decimal"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
            />
            {fieldErrors.totalAmount && <span className="field-error">{errMsg(fieldErrors.totalAmount)}</span>}
          </div>

          {/* Principal + Interest row */}
          <div className="form-row">
            <div className="field">
              <label className="field-label">{t("forms.loan.payment_dialog.field_principal")}</label>
              <input
                type="text"
                inputMode="decimal"
                value={principalPart}
                onChange={(e) => setPrincipalPart(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label className="field-label">{t("forms.loan.payment_dialog.field_interest")}</label>
              <input
                type="text"
                inputMode="decimal"
                value={interestPart}
                onChange={(e) => setInterestPart(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Account */}
          {accounts.length > 0 && (
            <div className="field">
              <label className="field-label">{t("forms.loan.payment_dialog.field_account")}</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div className="field">
            <label className="field-label">{t("forms.loan.payment_dialog.field_note")}</label>
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
