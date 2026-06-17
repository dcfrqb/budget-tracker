"use client";

import { useState, useTransition } from "react";
import { FreelanceOrderStageStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import { useLocale } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";

import {
  createStageAction,
  deleteStageAction,
  markStagePaidAction,
  unmarkStageAction,
} from "@/app/(shell)/income/actions";

export type StageRow = {
  id: string;
  label: string;
  expectedAmount: Prisma.Decimal | string | number;
  dueDate: Date | null;
  sortOrder: number;
  status: FreelanceOrderStageStatus;
  paidAt: Date | null;
  paidAmount: Prisma.Decimal | string | number | null;
  currencyCode: string;
};

export type AccountOption = {
  id: string;
  name: string;
  currencyCode: string;
};

interface Props {
  freelanceOrderId: string;
  stages: StageRow[];
  orderAmount: Prisma.Decimal | string | number;
  currencyCode: string;
  accounts: AccountOption[];
  onMutated?: () => void;
}

function StagePayForm({
  stage,
  accounts,
  onCancel,
  onPaid,
}: {
  stage: StageRow;
  accounts: AccountOption[];
  onCancel: () => void;
  onPaid: () => void;
}) {
  const t = useT();
  const [isPending, start] = useTransition();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [paidAmount, setPaidAmount] = useState(
    new Prisma.Decimal(stage.expectedAmount).toFixed(2),
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await markStagePaidAction({
        stageId: stage.id,
        accountId,
        paidAmount,
      });
      if (!result.ok) {
        setError(result.formError ?? "error");
        return;
      }
      onPaid();
    });
  }

  return (
    <form className="fo-stage-pay-form" onSubmit={handleSubmit}>
      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 160px" }}>
          <label
            className="field-label mono"
            style={{ fontSize: "var(--text-xs)", display: "block", marginBottom: 2 }}
          >
            {t("forms.freelance_order_stage.pay_account_label")}
          </label>
          <select
            className="input"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            style={{ height: 28, fontSize: "var(--text-xs)" }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currencyCode})
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label
            className="field-label mono"
            style={{ fontSize: "var(--text-xs)", display: "block", marginBottom: 2 }}
          >
            {t("forms.freelance_order_stage.pay_amount_label")}
          </label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            style={{ height: 28, fontSize: "var(--text-xs)" }}
          />
        </div>
        <div style={{ display: "flex", gap: "var(--sp-1)", flexShrink: 0, paddingBottom: 0 }}>
          <button type="submit" className="btn-sm" disabled={isPending || !accountId}>
            {t("forms.freelance_order_stage.mark_paid")}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
            {t("forms.common.cancel")}
          </button>
        </div>
      </div>
      {error && (
        <div className="field-error" role="alert" style={{ fontSize: "var(--text-xs)" }}>
          {error}
        </div>
      )}
    </form>
  );
}

function AddStageForm({
  freelanceOrderId,
  currencyCode,
  onAdded,
  onCancel,
}: {
  freelanceOrderId: string;
  currencyCode: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [isPending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await createStageAction({
        freelanceOrderId,
        label,
        expectedAmount,
      });
      if (!result.ok) {
        setError(result.formError ?? "error");
        return;
      }
      setLabel("");
      setExpectedAmount("");
      onAdded();
    });
  }

  return (
    <form className="fo-stage-pay-form" onSubmit={handleSubmit}>
      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 180px" }}>
          <label className="field-label mono" style={{ fontSize: "var(--text-xs)", display: "block", marginBottom: 2 }}>
            {t("forms.freelance_order_stage.field.label")}
          </label>
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ height: 28, fontSize: "var(--text-xs)" }}
            placeholder={t("forms.freelance_order_stage.field.label")}
          />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label className="field-label mono" style={{ fontSize: "var(--text-xs)", display: "block", marginBottom: 2 }}>
            {t("forms.freelance_order_stage.field.expected")} ({currencyCode})
          </label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={expectedAmount}
            onChange={(e) => setExpectedAmount(e.target.value)}
            style={{ height: 28, fontSize: "var(--text-xs)" }}
          />
        </div>
        <div style={{ display: "flex", gap: "var(--sp-1)", flexShrink: 0 }}>
          <button type="submit" className="btn-sm" disabled={isPending || !label || !expectedAmount}>
            {t("forms.common.save")}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
            {t("forms.common.cancel")}
          </button>
        </div>
      </div>
      {error && (
        <div className="field-error" role="alert" style={{ fontSize: "var(--text-xs)" }}>
          {error}
        </div>
      )}
    </form>
  );
}

export function FreelanceOrderStages({
  freelanceOrderId,
  stages,
  orderAmount,
  currencyCode,
  accounts,
  onMutated,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const [payingStageId, setPayingStageId] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState(false);
  const [_isPending, start] = useTransition();
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);

  const plan = new Prisma.Decimal(orderAmount);

  // Compute stageTotal for mismatch warning
  const stageTotal = stages.reduce(
    (s, st) => s.plus(new Prisma.Decimal(st.expectedAmount)),
    new Prisma.Decimal(0),
  );
  const hasMismatch = stages.length > 0 && !stageTotal.eq(plan);

  // Compute received from PAID stages
  const received = stages
    .filter((s) => s.status === FreelanceOrderStageStatus.PAID && s.paidAmount != null)
    .reduce((sum, s) => sum.plus(new Prisma.Decimal(s.paidAmount!)), new Prisma.Decimal(0));

  const remaining = plan.minus(received).lt(0) ? new Prisma.Decimal(0) : plan.minus(received);
  const pct = plan.gt(0) ? received.div(plan).mul(100).toNumber() : 0;
  const clampedPct = Math.min(100, Math.max(0, pct));

  function handleUnmark(stageId: string) {
    start(async () => {
      await unmarkStage({ stageId });
      onMutated?.();
    });
  }

  async function unmarkStage(input: { stageId: string }) {
    return unmarkStageAction(input);
  }

  function handleDelete(stageId: string) {
    setStageToDelete(stageId);
  }

  function confirmDeleteStage() {
    if (!stageToDelete) return;
    const id = stageToDelete;
    setStageToDelete(null);
    start(async () => {
      await deleteStageAction({ stageId: id });
      onMutated?.();
    });
  }

  return (
    <div>
      {/* Plan/fact bar */}
      <div className="fo-order-bar">
        <div className="fo-order-bar-label">
          {t("income.work.detail.orders.plan_fact", {
            vars: {
              received: formatMoney(received, currencyCode),
              plan: formatMoney(plan, currencyCode),
              remaining: formatMoney(remaining, currencyCode),
            },
          })}
        </div>
        <div className="src-cmp-bar-track">
          <div
            className="src-cmp-bar-fill"
            style={{
              width: `${clampedPct}%`,
              background: received.gte(plan) ? "var(--pos)" : "var(--accent)",
            }}
          />
        </div>
      </div>

      {hasMismatch && (
        <div className="fo-warn">
          {t("forms.freelance_order_stage.sum_mismatch_warning")}
        </div>
      )}

      {/* Stages list */}
      {stages.length === 0 ? (
        <div
          className="mono"
          style={{
            padding: "var(--sp-3) 0",
            fontSize: "var(--text-xs)",
            color: "var(--muted)",
          }}
        >
          {t("income.order_detail.empty_stages")}
        </div>
      ) : (
        <div className="fo-stage-list" style={{ marginTop: "var(--sp-2)" }}>
          {stages.map((stage) => {
            const isPaying = payingStageId === stage.id;
            const isPaid = stage.status === FreelanceOrderStageStatus.PAID;
            return (
              <div key={stage.id}>
                <div className="fo-stage-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="fo-stage-label">{stage.label}</div>
                    <div className="fo-stage-meta">
                      {formatMoney(new Prisma.Decimal(stage.expectedAmount), stage.currencyCode)}
                      {stage.dueDate && ` · ${formatDate(stage.dueDate, locale)}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    {isPaid ? (
                      <>
                        <span className="fo-stage-badge--paid">
                          {stage.paidAmount
                            ? formatMoney(new Prisma.Decimal(stage.paidAmount), stage.currencyCode)
                            : t("forms.freelance_order_stage.status.paid")}
                        </span>
                        {stage.paidAt && (
                          <span className="fo-stage-meta">{formatDate(stage.paidAt, locale)}</span>
                        )}
                        <button
                          className="btn-ghost"
                          style={{ fontSize: "var(--text-xs)", padding: "1px 6px" }}
                          onClick={() => handleUnmark(stage.id)}
                        >
                          {t("forms.freelance_order_stage.unmark")}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="fo-stage-badge--pending mono" style={{ fontSize: "var(--text-xs)" }}>
                          {t("forms.freelance_order_stage.status.pending")}
                        </span>
                        <button
                          className="btn-sm"
                          style={{ padding: "2px 8px" }}
                          onClick={() => setPayingStageId(isPaying ? null : stage.id)}
                        >
                          {t("forms.freelance_order_stage.mark_paid")}
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: "var(--text-xs)", padding: "1px 6px" }}
                          onClick={() => handleDelete(stage.id)}
                        >
                          {t("forms.freelance_order_stage.delete_stage")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {isPaying && !isPaid && (
                  <StagePayForm
                    stage={stage}
                    accounts={accounts}
                    onCancel={() => setPayingStageId(null)}
                    onPaid={() => {
                      setPayingStageId(null);
                      onMutated?.();
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add stage */}
      {addingStage ? (
        <AddStageForm
          freelanceOrderId={freelanceOrderId}
          currencyCode={currencyCode}
          onAdded={() => {
            setAddingStage(false);
            onMutated?.();
          }}
          onCancel={() => setAddingStage(false)}
        />
      ) : (
        <button
          className="btn-ghost"
          style={{ fontSize: "var(--text-xs)", marginTop: "var(--sp-2)" }}
          onClick={() => setAddingStage(true)}
        >
          {t("forms.freelance_order_stage.add_stage")}
        </button>
      )}

      <Dialog
        open={stageToDelete !== null}
        onOpenChange={(open) => { if (!open) setStageToDelete(null); }}
        title={t("forms.freelance_order_stage.delete_stage")}
        size="sm"
        footer={
          <div style={{ display: "flex", gap: "var(--sp-2)", width: "100%" }}>
            <button
              type="button"
              className="btn"
              onClick={() => setStageToDelete(null)}
            >
              {t("forms.common.cancel")}
            </button>
            <button
              type="button"
              className="btn"
              style={{ marginLeft: "auto", color: "var(--neg)", borderColor: "var(--neg)" }}
              onClick={confirmDeleteStage}
            >
              {t("forms.common.delete")}
            </button>
          </div>
        }
      >
        <p
          className="mono"
          style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0 }}
        >
          {t("forms.freelance_order_stage.delete_stage_confirm")}
        </p>
      </Dialog>
    </div>
  );
}
