"use client";

import React, { useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { ReimbursementDialog } from "./reimbursement-dialog";
import {
  missTransactionAction,
  cancelTransactionAction,
  deleteTransactionAction,
} from "@/app/(shell)/transactions/actions";
import type { TxnView } from "@/lib/view/transactions";
import type { AccountOption } from "@/components/forms/account-select";

interface TxnRowActionsProps {
  txn: TxnView;
  accounts: AccountOption[];
}

// ─────────────────────────────────────────────────────────────
// Small confirm-danger dialog for miss/cancel
// ─────────────────────────────────────────────────────────────

interface DangerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  isPending: boolean;
}

function DangerDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  onConfirm,
  isPending,
}: DangerDialogProps) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="btn"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("dialog.confirm_no")}
          </button>
          <button
            type="button"
            className="btn urgent"
            onClick={onConfirm}
            disabled={isPending}
            style={{ marginLeft: "auto" }}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p style={{ fontFamily: "var(--mono-font, monospace)", fontSize: "13px", color: "var(--text)" }}>
        {message}
      </p>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Main TxnRowActions
// ─────────────────────────────────────────────────────────────

export function TxnRowActions({ txn, accounts }: TxnRowActionsProps) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reimbOpen, setReimbOpen] = useState(false);
  const [missOpen, setMissOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Optimistic status update for confirm
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(txn.status);

  function handleMiss() {
    setMissOpen(false);
    startTransition(async () => {
      const result = await missTransactionAction(txn.id);
      if (!result.ok) {
        // Error: nothing to do silently — page will revalidate
      }
    });
  }

  function handleCancel() {
    setCancelOpen(false);
    startTransition(async () => {
      const result = await cancelTransactionAction(txn.id);
      if (!result.ok) {
        // Error: nothing to do silently
      }
    });
  }

  function handleDelete() {
    setDeleteOpen(false);
    startTransition(async () => {
      const result = await deleteTransactionAction(txn.id);
      if (!result.ok) {
        // Error: nothing to do silently
      }
    });
  }

  const canConfirm = txn.status === "planned" || txn.status === "partial";
  const canMiss = txn.status === "planned";
  const canCancel =
    txn.status === "planned" ||
    txn.status === "partial";
  const isReimbursable = txn.reimbursable === true;

  return (
    <>
      {/* Action buttons row */}
      <div className="txn-actions" data-optimistic-status={optimisticStatus}>
        {canConfirm && (
          <button
            type="button"
            className="btn primary"
            style={{ fontSize: "10px", padding: "3px 8px" }}
            onClick={() => {
              setOptimisticStatus("done");
              setConfirmOpen(true);
            }}
            disabled={isPending}
          >
            {t("forms.tx_row.confirm")}
          </button>
        )}
        {isReimbursable && (
          <button
            type="button"
            className="btn"
            style={{ fontSize: "10px", padding: "3px 8px" }}
            onClick={() => setReimbOpen(true)}
            disabled={isPending}
          >
            {t("forms.tx_row.reimburse")}
          </button>
        )}
        {canMiss && (
          <button
            type="button"
            className="btn"
            style={{ fontSize: "10px", padding: "3px 8px", color: "var(--warn)" }}
            onClick={() => setMissOpen(true)}
            disabled={isPending}
          >
            {t("forms.tx_row.miss")}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            className="btn"
            style={{ fontSize: "10px", padding: "3px 8px", color: "var(--dim)" }}
            onClick={() => setCancelOpen(true)}
            disabled={isPending}
          >
            {t("forms.tx_row.cancel")}
          </button>
        )}
        <button
          type="button"
          className="btn"
          style={{ fontSize: "10px", padding: "3px 8px" }}
          onClick={() => router.push(`/transactions/${txn.id}/edit`)}
        >
          {t("forms.tx_row.edit")}
        </button>
        <button
          type="button"
          className="btn"
          style={{ fontSize: "10px", padding: "3px 8px", color: "var(--neg)" }}
          onClick={() => setDeleteOpen(true)}
          disabled={isPending}
        >
          {t("forms.tx_row.delete")}
        </button>
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setOptimisticStatus(txn.status);
        }}
        transactionId={txn.id}
        onDone={() => setOptimisticStatus("done")}
      />

      {/* Reimbursement dialog */}
      <ReimbursementDialog
        open={reimbOpen}
        onOpenChange={setReimbOpen}
        transactionId={txn.id}
        accounts={accounts}
      />

      {/* Miss confirm */}
      <DangerDialog
        open={missOpen}
        onOpenChange={setMissOpen}
        title={t("forms.tx_row.miss")}
        message={t("forms.tx_row.are_you_sure")}
        confirmLabel={t("forms.tx_row.yes_miss")}
        onConfirm={handleMiss}
        isPending={isPending}
      />

      {/* Cancel confirm */}
      <DangerDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t("forms.tx_row.cancel")}
        message={t("forms.tx_row.are_you_sure")}
        confirmLabel={t("forms.tx_row.yes_cancel")}
        onConfirm={handleCancel}
        isPending={isPending}
      />

      {/* Delete confirm */}
      <DangerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("forms.tx_row.delete")}
        message={t("forms.tx_row.delete_confirm_body")}
        confirmLabel={t("forms.tx_row.yes_delete")}
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </>
  );
}
