"use client";

import React, { useState, useTransition } from "react";
import { useT } from "@/lib/i18n";
import {
  addFxPairAction,
} from "@/app/(shell)/wallet/actions";

export type CurrencyOption = { code: string; symbol: string };

type Props = {
  currencies: CurrencyOption[];
  // Set of currency codes available from CBR — others are disabled.
  cbrAvailableCodes: string[];
  onClose: () => void;
};

export function FxAddDialog({ currencies, cbrAvailableCodes, onClose }: Props) {
  const t = useT();
  const availableSet = new Set(cbrAvailableCodes);
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("RUB");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (from === to) {
      setError(t("wallet.fx.add_pair.same_currency_error"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addFxPairAction(from, to);
      if (result.ok) {
        onClose();
      } else {
        setError(t("forms.common.form_error.internal"));
      }
    });
  }

  return (
    <div
      className="fx-add-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={t("wallet.fx.add_pair.title")}
    >
      <div className="fx-add-dialog__title mono dim">{t("wallet.fx.add_pair.title")}</div>
      <form onSubmit={handleSubmit} className="fx-add-dialog__form">
        <div className="fx-add-dialog__row">
          <label className="fx-add-dialog__label mono dim">
            {t("wallet.fx.add_pair.from_label")}
          </label>
          <select
            className="fx-add-dialog__select"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={isPending}
          >
            {currencies.map((c) => {
              const unsupported = !availableSet.has(c.code);
              return (
                <option key={c.code} value={c.code} disabled={unsupported}>
                  {c.code}{unsupported ? " *" : ""}
                </option>
              );
            })}
          </select>
        </div>
        <div className="fx-add-dialog__row">
          <label className="fx-add-dialog__label mono dim">
            {t("wallet.fx.add_pair.to_label")}
          </label>
          <select
            className="fx-add-dialog__select"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={isPending}
          >
            {currencies.map((c) => {
              const unsupported = !availableSet.has(c.code);
              return (
                <option key={c.code} value={c.code} disabled={unsupported}>
                  {c.code}{unsupported ? " *" : ""}
                </option>
              );
            })}
          </select>
        </div>
        {error && (
          <div className="fx-add-dialog__error mono" style={{ color: "var(--col-neg)" }}>
            {error}
          </div>
        )}
        {cbrAvailableCodes.length === 0 && (
          <div className="fx-add-dialog__hint mono dim" style={{ fontSize: "var(--text-xs)" }}>
            {t("wallet.fx.add_pair.unsupported")}
          </div>
        )}
        <div className="fx-add-dialog__actions">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={isPending}
          >
            {t("wallet.fx.add_pair.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn--accent"
            disabled={isPending || from === to}
          >
            {isPending ? t("forms.common.loading") : t("wallet.fx.add_pair.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
