"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { createCashLocationAction } from "@/app/(shell)/wallet/actions";
import type { CashStashView } from "@/lib/view/wallet";

export type CurrencyOption = { code: string; symbol: string };

type Props = {
  stash: CashStashView[];
  meta: string;
  currencies: CurrencyOption[];
  primaryCurrency: string;
};

export function CashStashSection({ stash, meta, currencies, primaryCurrency }: Props) {
  const t = useT();
  const [showForm, setShowForm] = useState(false);
  const [location, setLocation] = useState("");
  const [currencyCode, setCurrencyCode] = useState(primaryCurrency);
  const [balance, setBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setShowForm(true);
    setLocation("");
    setCurrencyCode(primaryCurrency);
    setBalance("0");
    setError(null);
  }

  function handleCancel() {
    setShowForm(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim()) {
      setError(t("forms.common.required"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createCashLocationAction({
        location: location.trim(),
        currencyCode,
        balance: balance || "0",
      });
      if (result.ok) {
        setShowForm(false);
      } else {
        setError(result.formError ?? t("forms.common.form_error.internal"));
      }
    });
  }

  return (
    <div className="section fade-in" style={{ animationDelay: "340ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("wallet.cash.section_title")}</b> <span className="dim">{t("wallet.cash.section_sub")}</span>
        </div>
        <div className="meta mono">{meta}</div>
      </div>
      <div className="section-body flush">
        <div className="cash-grid">
          {stash.map((c) => (
            <Link key={c.id} href={`/wallet/cash/${c.id}/edit`} className="cash-cell">
              <div className="top">
                <span className="sym mono">{c.sym}</span>
                <span className="loc mono">{c.loc}</span>
              </div>
              <div className="v">{c.value}</div>
              <div className="s">{c.sub}</div>
            </Link>
          ))}
          {!showForm && (
            <div
              className="cash-cell add"
              tabIndex={0}
              role="button"
              onClick={handleAdd}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleAdd(); }}
            >
              <div>
                <div style={{ fontSize: 18, color: "var(--accent)" }}>+</div>
                <div className="mono" style={{ fontSize: 11, marginTop: 3 }}>{t("wallet.cash.add_location.title")}</div>
              </div>
            </div>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="cash-add-form">
            <div className="cash-add-title mono">{t("wallet.cash.add_location.title")}</div>
            <div className="cash-add-fields">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("wallet.cash.add_location.placeholder_location")}
                maxLength={120}
                required
                autoFocus
              />
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder={t("wallet.cash.add_location.placeholder_balance")}
              />
            </div>
            {error && <div className="field-error" role="alert">{error}</div>}
            <div className="cash-add-actions">
              <button type="submit" className="btn primary" disabled={isPending}>
                {isPending ? t("forms.common.loading") : t("wallet.cash.add_location.submit")}
              </button>
              <button type="button" className="btn" onClick={handleCancel} disabled={isPending}>
                {t("wallet.cash.add_location.cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
