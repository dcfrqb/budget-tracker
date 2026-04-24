"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import { FundContributeDialog } from "@/components/planning/fund-contribute-dialog";
import { deleteFundAction } from "@/app/(shell)/planning/funds/actions";
import type { AccountOption } from "@/components/forms/account-select";

export type FundStat = { k: string; v: string; tone?: string };

export type FundCardView = {
  id: string;
  kind: string;
  kindLabel: string;
  dueLabel: string;
  name: string;
  sub: string;
  stats: FundStat[];
  progLeft: string;
  progRight: string;
  pct: number;
  hours: number;
  hoursUnit: string;
  currencyCode: string;
  currentAmount: string;
};

type FundCardProps = {
  fund: FundCardView;
  accounts: AccountOption[];
};

function FundCard({ fund, accounts }: FundCardProps) {
  const t = useT();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPendingDelete, startDeleteTransition] = useTransition();

  function handleDelete() {
    startDeleteTransition(async () => {
      await deleteFundAction(fund.id);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <article className="fund-card" tabIndex={0}>
      <div className="fund-top">
        <span className={`fund-kind ${fund.kind}`}>{fund.kindLabel}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{fund.dueLabel}</span>
      </div>
      <div className="fund-name">
        {fund.name}
        <div className="sub">{fund.sub}</div>
      </div>
      <div className="fund-stats">
        {fund.stats.map((s, i) => (
          <div key={i}>
            <div className="k">{s.k}</div>
            <div className={`v ${s.tone ?? ""}`}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="fund-prog-wrap">
        <div className="fund-prog-lbl">
          <span>{fund.progLeft}</span>
          <span>{fund.progRight}</span>
        </div>
        <div className="fund-prog">
          <div className="fill" style={{ width: `${fund.pct}%` }} />
        </div>
      </div>
      <div className="fund-hours">
        <span>{t("planning.fund_stat.saved")}</span>
        <span><span className="hrs">{fund.hours}</span> <span className="unit">{fund.hoursUnit}</span></span>
      </div>
      <div className="sub-btns" style={{ marginTop: 8 }}>
        <FundContributeDialog
          fundId={fund.id}
          fundName={fund.name}
          fundCurrencyCode={fund.currencyCode}
          currentAmount={fund.currentAmount}
          accounts={accounts}
          onContributed={() => router.refresh()}
        />
        <Link href={`/planning/funds/${fund.id}/edit`} className="btn">
          {t("buttons.edit")}
        </Link>
        <button type="button" className="btn" onClick={() => setDeleteOpen(true)}>
          {t("buttons.delete")}
        </button>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("forms.fund.delete_confirm_title")}
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
          {t("forms.fund.delete_confirm_body", { vars: { name: fund.name } })}
        </p>
      </Dialog>
    </article>
  );
}

export function FundsSection({
  funds,
  accounts,
  addLabel,
}: {
  funds: FundCardView[];
  accounts?: AccountOption[];
  addLabel?: string;
}) {
  const t = useT();
  const accs = accounts ?? [];
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("planning.funds.section_title")}</b>{" "}
          <span className="dim">· {funds.length} {t("planning.kpi.saved_sub", { vars: { count: String(funds.length) } })}</span>
        </div>
        <div className="meta mono">
          <Link
            href="/planning/funds/new"
            className="btn primary"
            style={{ padding: "3px 9px", fontSize: 10 }}
          >
            {addLabel ?? t("buttons.add_fund")}
          </Link>
        </div>
      </div>
      <div className="section-body flush">
        <div className="fund-grid">
          {funds.map((f) => (
            <FundCard key={f.id} fund={f} accounts={accs} />
          ))}
          <article className="fund-card add" tabIndex={0}>
            <div>
              <div className="plus">+</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text)" }}>{t("buttons.add_fund")}</div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
