"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SubscriptionCardView } from "@/lib/view/subscriptions";
import { Dialog } from "@/components/ui/dialog";
import { PayDialog } from "@/components/subscriptions/pay-dialog";
import { deleteSubscriptionAction } from "@/app/(shell)/expenses/subscriptions/actions";
import { useT } from "@/lib/i18n";

type Props = {
  card: SubscriptionCardView;
};

export function SubscriptionCard({ card }: Props) {
  const t = useT();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPendingDelete, startDeleteTransition] = useTransition();

  const icoStyle: React.CSSProperties = {
    background: card.iconBg ?? "var(--panel-2)",
    color: card.iconColor ?? "var(--text)",
  };

  function handleDelete() {
    startDeleteTransition(async () => {
      await deleteSubscriptionAction(card.id);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <article className="sub-card" tabIndex={0}>
      <div className="sub-top">
        <div className="sub-ico" style={icoStyle}>
          {card.icon ?? card.name.charAt(0).toUpperCase()}
        </div>
        <span className={`sub-badge ${card.badgeClass}`}>{card.badgeLabel}</span>
      </div>
      <div>
        <div className="sub-name">{card.name}</div>
        <div className="sub-meta">
          <span>{card.interval}</span>
          {card.myShare && (
            <span style={{ color: "var(--muted)" }}>{card.myShare}</span>
          )}
        </div>
      </div>
      <div className="sub-foot">
        <span className="sub-amt">
          {card.price}
          {card.sharesCount > 0 && (
            <span
              className="mono"
              style={{
                color: card.badgeClass === "pays" ? "var(--accent)" : "var(--muted)",
                fontSize: 11,
                fontWeight: 400,
                marginLeft: 5,
              }}
            >
              {"+"}{card.sharesCount}
            </span>
          )}
        </span>
        <span className={`sub-next${card.nextToneOk ? " ok" : ""}`}>{card.nextDate}</span>
      </div>
      <div className="sub-btns">
        <PayDialog
          subscriptionId={card.id}
          subscriptionName={card.name}
          subscriptionAmount={card.price}
          billingIntervalMonths={card.billingIntervalMonths}
          currentNextPaymentDate={card.nextPaymentDateIso}
          onPaid={() => router.refresh()}
        />
        <Link href={`/expenses/subscriptions/${card.id}/edit`} className="btn">
          {t("buttons.edit")}
        </Link>
        <button
          type="button"
          className="btn"
          onClick={() => setDeleteOpen(true)}
        >
          {t("buttons.delete")}
        </button>
      </div>

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("forms.sub.delete_confirm_title")}
        size="sm"
        footer={
          <div className="submit-row-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={isPendingDelete}
            >
              {t("forms.common.cancel")}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleDelete}
              disabled={isPendingDelete}
            >
              {isPendingDelete ? "..." : t("forms.common.delete")}
            </button>
          </div>
        }
      >
        <p className="mono" style={{ fontSize: 13, color: "var(--text)" }}>
          {t("forms.sub.delete_confirm_body", { vars: { name: card.name } })}
        </p>
      </Dialog>
    </article>
  );
}
