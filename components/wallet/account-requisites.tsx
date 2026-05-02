"use client";

import React, { useState, useTransition } from "react";
import { useT } from "@/lib/i18n";

type RequisitesData = {
  id: string;
  inn: string | null;
  kpp: string | null;
  correspondentAccount: string | null;
  accountNumber: string | null;
  bic: string | null;
  bankName: string | null;
  recipientName: string | null;
};

type Props = {
  account: RequisitesData;
  hasIntegration: boolean;
  pullAction: () => Promise<{ ok: boolean; error?: string }>;
};

function CopyButton({ value }: { value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      className="btn"
      style={{ padding: "2px 8px", fontSize: 10, minWidth: 64 }}
      onClick={handleCopy}
    >
      {copied ? t("wallet.account.requisites.copied") : t("wallet.account.requisites.copy")}
    </button>
  );
}

type FieldRow = {
  labelKey: string;
  value: string;
};

export function AccountRequisites({ account, hasIntegration, pullAction }: Props) {
  const t = useT();
  const [isPulling, startPull] = useTransition();
  const [pullError, setPullError] = useState<string | null>(null);

  const rows: FieldRow[] = [];

  if (account.accountNumber) {
    rows.push({ labelKey: "wallet.account.requisites.account_number", value: account.accountNumber });
  }
  if (account.bic) {
    rows.push({ labelKey: "wallet.account.requisites.bic", value: account.bic });
  }
  if (account.bankName) {
    rows.push({ labelKey: "wallet.account.requisites.bank_name", value: account.bankName });
  }
  if (account.inn) {
    rows.push({ labelKey: "wallet.account.requisites.inn", value: account.inn });
  }
  if (account.kpp) {
    rows.push({ labelKey: "wallet.account.requisites.kpp", value: account.kpp });
  }
  if (account.correspondentAccount) {
    rows.push({ labelKey: "wallet.account.requisites.corr_account", value: account.correspondentAccount });
  }
  if (account.recipientName) {
    rows.push({ labelKey: "wallet.account.requisites.recipient_name", value: account.recipientName });
  }

  const hasAnyField = rows.length > 0;

  if (!hasAnyField && !hasIntegration) return null;

  function handlePull() {
    setPullError(null);
    startPull(async () => {
      const result = await pullAction();
      if (!result.ok) {
        setPullError(t("wallet.account.requisites.pull_failed"));
      }
    });
  }

  return (
    <div style={{ marginTop: "var(--sp-6)" }}>
      <p className="form-section-label">
        {t("wallet.account.requisites.title")}
      </p>

      {rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {rows.map((row) => (
            <div
              key={row.labelKey}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-3)",
                padding: "6px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--muted)", minWidth: 140, flexShrink: 0 }}
              >
                {t(row.labelKey as Parameters<typeof t>[0])}
              </span>
              <span
                className="mono"
                style={{ fontSize: 12, color: "var(--text)", flex: 1, wordBreak: "break-all" }}
              >
                {row.value}
              </span>
              <CopyButton value={row.value} />
            </div>
          ))}
        </div>
      )}

      {hasIntegration && (
        <div style={{ marginTop: "var(--sp-4)" }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 11 }}
            disabled={isPulling}
            onClick={handlePull}
          >
            {isPulling
              ? t("wallet.account.requisites.pulling")
              : t("wallet.account.requisites.pull_from_tbank")}
          </button>
          {pullError && (
            <div className="field-error" role="alert" style={{ marginTop: "var(--sp-2)" }}>
              {pullError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
