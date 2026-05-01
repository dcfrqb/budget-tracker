"use client";

import React, { useState, useTransition } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { removeFxPairAction, refreshFxRatesAction } from "@/app/(shell)/wallet/actions";
import { FxAddDialog } from "./fx-add-dialog";
import { formatAgo, isStale } from "@/lib/fx/freshness";
import type { FxRateView } from "@/lib/view/wallet";

export type FxCurrencyOption = { code: string; symbol: string };

type Props = {
  rates: FxRateView[];
  currencies: FxCurrencyOption[];
  cbrAvailableCodes: string[];
  latestRecordedAt: Date | null;
};

export function FxRates({ rates, currencies, cbrAvailableCodes, latestRecordedAt }: Props) {
  const t = useT();
  const locale = useLocale();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isPendingRefresh, startRefreshTransition] = useTransition();
  const [isPendingRemove, startRemoveTransition] = useTransition();

  function handleRefresh() {
    startRefreshTransition(async () => {
      await refreshFxRatesAction();
    });
  }

  function handleRemove(pair: string) {
    startRemoveTransition(async () => {
      await removeFxPairAction(pair);
    });
  }

  const stale = isStale(latestRecordedAt);
  const updatedLabel = latestRecordedAt
    ? t("wallet.fx.updated_label", { vars: { ago: formatAgo(latestRecordedAt, locale) } })
    : null;

  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("wallet.fx.section_title")}</b>{" "}
          <span className="dim">· {t("wallet.fx.section_sub")}</span>
          {updatedLabel && (
            <span className="dim"> · {updatedLabel}</span>
          )}
          {stale && (
            <span style={{ color: "var(--warn)" }}> · {t("wallet.fx.stale_warning")}</span>
          )}
        </div>
        <div className="meta mono">
          <button
            type="button"
            className="btn"
            style={{ padding: "3px 9px", fontSize: 10 }}
            onClick={handleRefresh}
            disabled={isPendingRefresh}
            title={t("wallet.fx.refresh")}
          >
            {isPendingRefresh ? "..." : "↻"}
          </button>
        </div>
      </div>
      <div className="section-body flush">
        <div className="rates-row">
          {rates.map((r) => {
            const pairStr = `${r.pair[0]}/${r.pair[1]}`;
            return (
              <div key={pairStr} className="rate" style={{ position: "relative" }}>
                <span className="pair mono">
                  {r.pair[0]}
                  <b> / </b>
                  {r.pair[1]}
                </span>
                <span>
                  <span className="val">{r.val}</span>
                  <span className={`delta ${r.deltaTone}`}>{r.delta}</span>
                </span>
                <button
                  type="button"
                  className="btn"
                  aria-label={t("wallet.fx.remove_pair.title")}
                  onClick={() => handleRemove(pairStr)}
                  disabled={isPendingRemove}
                  style={{
                    padding: "0 4px",
                    fontSize: 10,
                    lineHeight: 1,
                    opacity: 0.5,
                    marginLeft: "var(--sp-1)",
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          {/* Add pair button */}
          <div className="rate rate--add">
            <button
              type="button"
              className="btn"
              style={{ padding: "3px 9px", fontSize: 10 }}
              onClick={() => setShowAddDialog(true)}
            >
              {t("wallet.fx.add_pair.button")}
            </button>
          </div>
        </div>

        {showAddDialog && (
          <FxAddDialog
            currencies={currencies}
            cbrAvailableCodes={cbrAvailableCodes}
            onClose={() => setShowAddDialog(false)}
          />
        )}
      </div>
    </div>
  );
}
