"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SubscriptionCardView } from "@/lib/view/subscriptions";
import { Dialog } from "@/components/ui/dialog";
import { PayDialog } from "@/components/subscriptions/pay-dialog";
import { deleteSubscriptionAction } from "@/app/(shell)/expenses/subscriptions/actions";
import { useT } from "@/lib/i18n";
import { useSubscriptionSelection } from "./selection-context";

type Props = {
  card: SubscriptionCardView;
  tz?: string;
};

export function SubscriptionCard({ card, tz }: Props) {
  const t = useT();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPendingDelete, startDeleteTransition] = useTransition();
  const { selected, toggle } = useSubscriptionSelection();
  const isSelected = selected.has(card.id);

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

  function handleCardClick() {
    router.push(`?edit=sub:${card.id}`, { scroll: false });
  }

  function handleCardKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick();
    }
  }

  return (
    <article
      className={`sub-card${isSelected ? " sub-card--selected" : ""}`}
      tabIndex={0}
      role="button"
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      {/* Selection checkbox — stopPropagation so card click still navigates */}
      <button
        type="button"
        aria-label={isSelected ? t("expenses.subscriptions.merge.deselect_label") : t("expenses.subscriptions.merge.select_label")}
        aria-pressed={isSelected}
        className="sub-select-btn"
        onClick={(e) => { e.stopPropagation(); toggle(card.id); }}
        onKeyDown={(e) => { e.stopPropagation(); }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 18,
          height: 18,
          border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 3,
          background: isSelected ? "var(--accent)" : "var(--panel-2)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          opacity: isSelected ? 1 : 0,
          transition: "opacity 0.1s",
          zIndex: 2,
        }}
      >
        {isSelected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="var(--bg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
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
                fontSize: "var(--text-xs)",
                fontWeight: 400,
                marginLeft: 5,
              }}
            >
              {"+"}{card.sharesCount}
            </span>
          )}
          {card.isVariablePrice && (
            <span
              className="mono"
              style={{
                color: "var(--muted)",
                fontSize: "var(--text-xs)",
                fontWeight: 400,
                marginLeft: 6,
              }}
            >
              {t("expenses.subscriptions.card.variable_badge")}
            </span>
          )}
        </span>
        <span className={`sub-next${card.nextToneOk ? " ok" : ""}`}>{card.nextDate}</span>
      </div>
      <div className="sub-btns">
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <PayDialog
            subscriptionId={card.id}
            subscriptionName={card.name}
            subscriptionAmount={card.price}
            billingIntervalMonths={card.billingIntervalMonths}
            currentNextPaymentDate={card.nextPaymentDateIso}
            onPaid={() => router.refresh()}
            tz={tz}
            preferLinkMode={false}
          />
        </span>
        <Link
          href={`?edit=sub:${card.id}`}
          scroll={false}
          className="btn"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {t("buttons.edit")}
        </Link>
        <button
          type="button"
          className="btn"
          onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
          onKeyDown={(e) => e.stopPropagation()}
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
