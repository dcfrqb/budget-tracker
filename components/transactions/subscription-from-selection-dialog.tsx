"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useT } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import {
  createSubscriptionFromTransactionsAction,
  linkTransactionsToSubscriptionAction,
  getActiveSubscriptionsAction,
} from "@/app/(shell)/expenses/subscriptions/actions";

type Mode = "create" | "link";

type SubOption = { id: string; name: string; currencyCode: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionIds: string[];
  defaultCurrencyCode: string;
  onSuccess: (msgKey: string) => void;
};

const INTERVAL_OPTIONS = [1, 3, 6, 12] as const;

export function SubscriptionFromSelectionDialog({
  open,
  onOpenChange,
  transactionIds,
  defaultCurrencyCode,
  onSuccess,
}: Props) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [isVariablePrice, setIsVariablePrice] = useState(false);
  const [billingIntervalMonths, setBillingIntervalMonths] = useState<number>(1);
  const [currencyCode, setCurrencyCode] = useState(defaultCurrencyCode);
  const [selectedSubId, setSelectedSubId] = useState("");
  const [subs, setSubs] = useState<SubOption[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // Reset form on open
  useEffect(() => {
    if (!open) return;
    setMode("create");
    setName("");
    setIsVariablePrice(false);
    setBillingIntervalMonths(1);
    setCurrencyCode(defaultCurrencyCode);
    setSelectedSubId("");
    setErrorKey(null);
  }, [open, defaultCurrencyCode]);

  // Load subscriptions list when switching to "link" mode
  useEffect(() => {
    if (!open || mode !== "link") return;
    let cancelled = false;
    setLoadingSubs(true);
    getActiveSubscriptionsAction().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setSubs(res.data);
        setSelectedSubId(res.data[0]?.id ?? "");
      }
      setLoadingSubs(false);
    });
    return () => { cancelled = true; };
  }, [open, mode]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);

    startTransition(async () => {
      if (mode === "create") {
        const result = await createSubscriptionFromTransactionsAction({
          name,
          transactionIds,
          isVariablePrice,
          currencyCode,
          billingIntervalMonths,
        });
        if (result.ok) {
          onOpenChange(false);
          onSuccess("transactions.selection.success.subscription_created");
        } else {
          const errStr = result.formError ?? "internal_error";
          if (errStr === "conflict") setErrorKey("expenses.subscriptions.fromSelection.error_conflict");
          else if (errStr === "not_found") setErrorKey("expenses.subscriptions.fromSelection.error_not_found");
          else setErrorKey("expenses.subscriptions.fromSelection.error_internal");
        }
      } else {
        if (!selectedSubId) return;
        const result = await linkTransactionsToSubscriptionAction({
          subscriptionId: selectedSubId,
          transactionIds,
        });
        if (result.ok) {
          onOpenChange(false);
          onSuccess("transactions.selection.success.subscription_linked");
        } else {
          const errStr = result.formError ?? "internal_error";
          if (errStr === "conflict") setErrorKey("expenses.subscriptions.fromSelection.error_conflict");
          else if (errStr === "not_found") setErrorKey("expenses.subscriptions.fromSelection.error_not_found");
          else setErrorKey("expenses.subscriptions.fromSelection.error_internal");
        }
      }
    });
  }

  const canSubmit =
    !isPending &&
    (mode === "create" ? name.trim().length > 0 : !!selectedSubId);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("expenses.subscriptions.fromSelection.dialog_title")}
      size="sm"
      footer={
        <button
          type="submit"
          form="sub-from-selection-form"
          className="btn btn-primary"
          disabled={!canSubmit}
        >
          {mode === "create"
            ? t("expenses.subscriptions.fromSelection.submit_create")
            : t("expenses.subscriptions.fromSelection.submit_link")}
        </button>
      }
    >
      <form id="sub-from-selection-form" onSubmit={handleSubmit}>
        {/* Mode toggle */}
        <div className="field-row" style={{ marginBottom: "var(--sp-3)" }}>
          <div className="segmented-control">
            <button
              type="button"
              className={`seg-btn${mode === "create" ? " active" : ""}`}
              onClick={() => setMode("create")}
            >
              {t("expenses.subscriptions.fromSelection.mode_create")}
            </button>
            <button
              type="button"
              className={`seg-btn${mode === "link" ? " active" : ""}`}
              onClick={() => setMode("link")}
            >
              {t("expenses.subscriptions.fromSelection.mode_link")}
            </button>
          </div>
        </div>

        {/* Count badge */}
        <p className="dim" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--sp-3)" }}>
          {t("expenses.subscriptions.fromSelection.selected_count", {
            vars: { count: String(transactionIds.length) },
          })}
        </p>

        {mode === "create" && (
          <>
            {/* Name */}
            <div className="field-row">
              <label className="field-label">
                {t("expenses.subscriptions.fromSelection.field_name")}
              </label>
              <input
                className="input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("expenses.subscriptions.fromSelection.field_name_placeholder")}
                required
                autoFocus
              />
            </div>

            {/* Variable price */}
            <div className="field-row" style={{ flexDirection: "row", alignItems: "center", gap: "var(--sp-2)" }}>
              <input
                type="checkbox"
                id="sub-variable-price"
                checked={isVariablePrice}
                onChange={(e) => setIsVariablePrice(e.target.checked)}
              />
              <label htmlFor="sub-variable-price" className="field-label">
                {t("expenses.subscriptions.fromSelection.field_variable_price")}
              </label>
            </div>

            {/* Billing interval */}
            <div className="field-row">
              <label className="field-label">
                {t("expenses.subscriptions.fromSelection.field_interval")}
              </label>
              <select
                className="input"
                value={billingIntervalMonths}
                onChange={(e) => setBillingIntervalMonths(Number(e.target.value))}
              >
                {INTERVAL_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t(`expenses.subscriptions.fromSelection.field_interval_${n}` as Parameters<typeof t>[0])}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency */}
            <div className="field-row">
              <label className="field-label">
                {t("expenses.subscriptions.fromSelection.field_currency")}
              </label>
              <input
                className="input mono"
                type="text"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>
          </>
        )}

        {mode === "link" && (
          <div className="field-row">
            <label className="field-label">
              {t("expenses.subscriptions.fromSelection.select_subscription")}
            </label>
            {loadingSubs ? (
              <p className="dim">{t("expenses.subscriptions.fromSelection.loading_subscriptions")}</p>
            ) : subs.length === 0 ? (
              <p className="dim">{t("expenses.subscriptions.fromSelection.no_subscriptions")}</p>
            ) : (
              <select
                className="input"
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
              >
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.currencyCode})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {errorKey && (
          <p role="alert" className="neg" style={{ fontSize: "var(--text-xs)", marginTop: "var(--sp-2)" }}>
            {t(errorKey as Parameters<typeof t>[0])}
          </p>
        )}
      </form>
    </Dialog>
  );
}
