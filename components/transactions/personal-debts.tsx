"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import type { DebtView } from "@/lib/view/debts";
import {
  deletePersonalDebtAction,
  closePersonalDebtAction,
  reopenPersonalDebtAction,
} from "@/app/(shell)/transactions/personal-debts/actions";
import { DebtPaymentDialog } from "./personal-debts/payment-dialog";
import type { AccountOption } from "@/components/forms/account-select";

type Props = {
  debts: DebtView[];
  metaLine: string;
  accounts?: AccountOption[];
  showClosed?: boolean;
};

export function PersonalDebts({ debts, metaLine, accounts = [], showClosed = false }: Props) {
  const t = useT();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [paymentDebtId, setPaymentDebtId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    const result = await deletePersonalDebtAction(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (!result.ok) {
      if (result.formError === "conflict") {
        setError(t("forms.personal_debt.has_transactions_hint"));
      } else {
        setError(t("forms.common.form_error.internal"));
      }
    }
  }

  async function handleClose(id: string) {
    setError(null);
    const result = await closePersonalDebtAction(id);
    if (!result.ok) setError(t("forms.common.form_error.internal"));
  }

  async function handleReopen(id: string) {
    setError(null);
    const result = await reopenPersonalDebtAction(id);
    if (!result.ok) setError(t("forms.common.form_error.internal"));
  }

  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("forms.tx.field.personal_debt")}</b>
        </div>
        <div className="meta mono">
          <span style={{ marginRight: 8 }}>{metaLine}</span>
          <Link
            href="/transactions/personal-debts/new"
            className="btn primary"
            style={{ padding: "3px 9px", fontSize: 10 }}
          >
            {t("buttons.add_debt")}
          </Link>
        </div>
      </div>
      {error && (
        <div className="mono" style={{ fontSize: 11, color: "var(--neg)", padding: "4px 20px" }}>
          {error}
        </div>
      )}
      <div className="section-body flush">
        <div className="debt-grid">
          {debts.map((d) => (
            <div key={d.id} className="debt-card" tabIndex={0}>
              <div className="debt-top">
                <span className={`debt-dir ${d.dir}`}>{d.dirLabel}</span>
                <span className="debt-meta">{d.since} · {d.until}</span>
              </div>
              <div>
                <div className="debt-name">{d.name}</div>
                <div className="debt-sub">{d.sub}</div>
              </div>
              <div className="debt-row">
                <span className={`debt-amt ${d.amountTone}`}>{d.amount}</span>
                <span className="debt-meta">{d.progressLabel}</span>
              </div>
              <div className="debt-prog">
                <div className="fill" style={{ width: `${d.progressPct}%` }} />
              </div>
              {/* Action buttons */}
              <div className="debt-actions" style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: "2px 6px" }}
                  onClick={() => setPaymentDebtId(d.id)}
                >
                  {t("buttons.record_return")}
                </button>
                <Link
                  href={`/transactions/personal-debts/${d.id}/edit`}
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: "2px 6px" }}
                >
                  {t("buttons.edit")}
                </Link>
                {showClosed ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "2px 6px" }}
                    onClick={() => handleReopen(d.id)}
                  >
                    {t("buttons.reopen_debt")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "2px 6px" }}
                    onClick={() => handleClose(d.id)}
                  >
                    {t("buttons.close_debt")}
                  </button>
                )}
                {confirmDeleteId === d.id ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: 10, padding: "2px 6px", color: "var(--neg)" }}
                      disabled={deletingId === d.id}
                      onClick={() => handleDelete(d.id)}
                    >
                      {deletingId === d.id ? "..." : t("buttons.confirm_delete")}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: 10, padding: "2px 6px" }}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      {t("forms.common.cancel")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "2px 6px" }}
                    onClick={() => setConfirmDeleteId(d.id)}
                  >
                    {t("buttons.delete")}
                  </button>
                )}
              </div>
            </div>
          ))}
          {debts.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              {t("common.no_data")}
            </div>
          )}
        </div>
      </div>

      {/* Payment dialog */}
      {paymentDebtId && (
        <DebtPaymentDialog
          open={paymentDebtId !== null}
          onOpenChange={(open) => { if (!open) setPaymentDebtId(null); }}
          debtId={paymentDebtId}
          accounts={accounts}
          onDone={() => setPaymentDebtId(null)}
        />
      )}
    </div>
  );
}
