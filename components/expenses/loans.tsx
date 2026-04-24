"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import { LoanPaymentDialog } from "@/components/loans/loan-payment-dialog";
import { deleteLoanAction } from "@/app/(shell)/expenses/loans/actions";
import type { AccountOption } from "@/components/forms/account-select";
import type { DefaultSplit } from "@/components/loans/loan-payment-dialog";

/* Amortization mini-chart: interest (top) decreases, principal (bottom) grows. */
function AmortChart() {
  const cols = Array.from({ length: 18 }, (_, i) => {
    const interest = 34 - i * 0.5;
    const principal = 66 + i * 0.5;
    return { i, interest, principal };
  });
  return (
    <div className="amort">
      {cols.map((c) => (
        <div key={c.i} className={`amort-col${c.i === 0 ? " current" : " future"}`}>
          <div className="interest" style={{ height: c.interest * 0.55 }} />
          <div className="principal" style={{ height: c.principal * 0.42 }} />
        </div>
      ))}
    </div>
  );
}

export type LoanStatItem = { k: string; v: string; tone?: string };

export type LoanCardView = {
  id: string;
  name: string;
  tag: string;
  sub: string;
  dueLabel: string;
  stats: LoanStatItem[];
  progressPct: number;
  progressLabel: string;
  progressSub: string;
  overpayStats: LoanStatItem[];
  defaultSplit?: DefaultSplit;
  defaultAccountId?: string;
};

type LoanCardProps = {
  loan: LoanCardView;
  accounts: AccountOption[];
};

function LoanCard({ loan, accounts }: LoanCardProps) {
  const t = useT();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPendingDelete, startDeleteTransition] = useTransition();

  function handleDelete() {
    startDeleteTransition(async () => {
      await deleteLoanAction(loan.id);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <article className="loan-card">
      <header className="loan-hd">
        <div>
          <div className="loan-tag">
            <span className="code">{loan.tag}</span>
            <span className="loan-name">{loan.name}</span>
          </div>
          <div className="loan-sub">{loan.sub}</div>
        </div>
        <div className="loan-due">{loan.dueLabel}</div>
      </header>
      <div className="loan-body">
        <div className="loan-cell">
          <div className="loan-stats">
            {loan.stats.map((s, i) => (
              <div key={i}>
                <div className="k">{s.k}</div>
                <div className={`v${s.tone ? ` ${s.tone}` : ""}`}>{s.v}</div>
              </div>
            ))}
          </div>
          <div className="loan-prog-wrap">
            <div className="loan-prog-lbl">
              <span>{loan.progressLabel}</span>
              <span>{loan.progressSub}</span>
            </div>
            <div className="loan-prog">
              <span className="paid" style={{ width: `${loan.progressPct}%` }} />
              <span className="rem" style={{ width: `${100 - loan.progressPct}%` }} />
            </div>
          </div>
        </div>
        <div className="loan-cell">
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
            амортизация
          </div>
          <AmortChart />
          {loan.overpayStats.length > 0 && (
            <div className="loan-cell overpay" style={{ marginTop: 8 }}>
              {loan.overpayStats.map((s, i) => (
                <div key={i} className="row">
                  <span className="k">{s.k}</span>
                  <span className={`v${s.tone ? ` ${s.tone}` : ""}`}>{s.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="sub-btns" style={{ marginTop: 8 }}>
        <LoanPaymentDialog
          loanId={loan.id}
          loanName={loan.name}
          defaultSplit={loan.defaultSplit}
          accounts={accounts}
          defaultAccountId={loan.defaultAccountId}
          onPaid={() => router.refresh()}
        />
        <Link href={`/expenses/loans/${loan.id}/edit`} className="btn">
          {t("buttons.edit")}
        </Link>
        <button type="button" className="btn" onClick={() => setDeleteOpen(true)}>
          {t("buttons.delete")}
        </button>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("forms.loan.delete_confirm_title")}
        size="sm"
        footer={
          <div className="submit-row-actions">
            <button type="button" className="btn-ghost" onClick={() => setDeleteOpen(false)} disabled={isPendingDelete}>
              {t("forms.common.cancel")}
            </button>
            <button type="button" className="btn-primary" onClick={handleDelete} disabled={isPendingDelete}>
              {isPendingDelete ? "..." : t("forms.common.delete")}
            </button>
          </div>
        }
      >
        <p className="mono" style={{ fontSize: 13, color: "var(--text)" }}>
          {t("forms.loan.delete_confirm_body", { vars: { name: loan.name } })}
        </p>
      </Dialog>
    </article>
  );
}

export function LoansSection({
  loans,
  accounts,
  addLabel,
}: {
  loans: LoanCardView[];
  accounts: AccountOption[];
  addLabel: string;
}) {
  const t = useT();
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>{t("expenses.loans.section_title")}</b></div>
        <div className="meta mono">
          <Link
            href="/expenses/loans/new"
            className="btn primary"
            style={{ padding: "3px 9px", fontSize: 10 }}
          >
            {addLabel}
          </Link>
        </div>
      </div>
      {loans.map((loan) => (
        <LoanCard key={loan.id} loan={loan} accounts={accounts} />
      ))}
      {loans.length === 0 && (
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
          {t("common.no_data")}
        </div>
      )}
    </div>
  );
}

// Backward-compat export (for expenses/page.tsx that doesn't pass props yet)
export function Loans() {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>кредиты / ипотека</b></div>
        <div className="meta mono">
          <Link
            href="/expenses/loans/new"
            className="btn primary"
            style={{ padding: "3px 9px", fontSize: 10 }}
          >
            + Кредит
          </Link>
        </div>
      </div>
    </div>
  );
}
