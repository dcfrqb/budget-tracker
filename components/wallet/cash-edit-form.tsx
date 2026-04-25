"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { updateAccountAction, archiveAccountAction } from "@/app/(shell)/wallet/actions";

export type CurrencyOption = { code: string; symbol: string };

interface Props {
  id: string;
  initialLocation: string;
  initialCurrency: string;
  initialBalance: string;
  initialIncludeInAnalytics: boolean;
  currencies: CurrencyOption[];
}

export function CashEditForm({
  id,
  initialLocation,
  initialCurrency,
  initialBalance,
  initialIncludeInAnalytics,
  currencies,
}: Props) {
  const t = useT();
  const router = useRouter();

  const [location, setLocation] = useState(initialLocation);
  const [currencyCode, setCurrencyCode] = useState(initialCurrency);
  const [balance, setBalance] = useState(initialBalance);
  const [includeInAnalytics, setIncludeInAnalytics] = useState(initialIncludeInAnalytics);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isArchiving, startArchive] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSave(async () => {
      const result = await updateAccountAction(id, {
        location: location.trim() || undefined,
        currencyCode,
        balance,
        includeInAnalytics,
      });
      if (result.ok) {
        router.push("/wallet");
      } else {
        setError(t("forms.common.form_error.internal"));
      }
    });
  }

  function handleArchive() {
    startArchive(async () => {
      const result = await archiveAccountAction(id);
      if (!result.ok) {
        setError(t("wallet.cash.edit.archive_failed"));
        return;
      }
      router.push("/wallet");
    });
  }

  const isPending = isSaving || isArchiving;

  return (
    <div>
      <h1 className="form-title">{t("wallet.cash.edit.title")}</h1>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="field">
          <label className="form-label" htmlFor="cash-location">
            {t("wallet.cash.add_location.placeholder_location")}
          </label>
          <input
            id="cash-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("wallet.cash.add_location.placeholder_location")}
            maxLength={120}
          />
        </div>

        <div className="field">
          <label className="form-label" htmlFor="cash-currency">
            {t("forms.account.field.currency")}
          </label>
          <select
            id="cash-currency"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="form-label" htmlFor="cash-balance">
            {t("forms.account.field.balance")}
          </label>
          <input
            id="cash-balance"
            type="text"
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder={t("wallet.cash.add_location.placeholder_balance")}
          />
        </div>

        <div className="field">
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeInAnalytics}
              onChange={(e) => setIncludeInAnalytics(e.target.checked)}
            />
            <span className="form-label" style={{ margin: 0 }}>
              {t("wallet.account.form.include_in_analytics.label")}
            </span>
          </label>
          <div className="field-hint">{t("wallet.account.form.include_in_analytics.hint")}</div>
        </div>

        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}

        <div className="submit-row">
          <div className="submit-row-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => router.back()}
              disabled={isPending}
            >
              {t("wallet.cash.edit.cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isSaving ? "..." : t("wallet.cash.edit.save")}
            </button>
          </div>
        </div>
      </form>

      <div style={{ marginTop: "var(--sp-4)" }}>
        <button
          type="button"
          className="btn-ghost"
          disabled={isPending}
          onClick={handleArchive}
        >
          {t("wallet.cash.edit.archive")}
        </button>
      </div>
    </div>
  );
}
