"use client";

import React, { useMemo, useState } from "react";
import { Prisma, BusinessEntryType } from "@prisma/client";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format/money";
import { createBusinessAllocationAction } from "@/app/(shell)/business/actions";

type Row = {
  key: string;
  amount: string;
  entryType: BusinessEntryType;
  streamKey: string;
  tariff: string;
  note: string;
};

function makeRow(): Row {
  return {
    key: Math.random().toString(36).slice(2),
    amount: "",
    entryType: BusinessEntryType.REVENUE,
    streamKey: "",
    tariff: "",
    note: "",
  };
}

export interface AllocationSplitEditorProps {
  businessId: string;
  transactionId: string;
  transactionAmount: string;
  currencyCode: string;
  onSuccess?: () => void;
}

export function AllocationSplitEditor({
  businessId,
  transactionId,
  transactionAmount,
  currencyCode,
  onSuccess,
}: AllocationSplitEditorProps) {
  const t = useT();
  const [rows, setRows] = useState<Row[]>([makeRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const txnAmount = useMemo(() => new Prisma.Decimal(transactionAmount), [transactionAmount]);

  const allocated = useMemo(() => {
    return rows.reduce((sum, r) => {
      const v = r.amount.trim();
      if (!v || Number.isNaN(Number(v))) return sum;
      try {
        return sum.plus(new Prisma.Decimal(v));
      } catch {
        return sum;
      }
    }, new Prisma.Decimal(0));
  }, [rows]);

  const remainder = txnAmount.minus(allocated);
  const isOverAllocated = allocated.gt(txnAmount);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isOverAllocated) {
      setError(t("business.allocation.error.over_allocated"));
      return;
    }

    const validRows = rows.filter((r) => r.amount.trim() !== "");
    if (validRows.length === 0) {
      setError(t("business.allocation.split.empty_error"));
      return;
    }

    setIsSubmitting(true);
    for (const row of validRows) {
      const result = await createBusinessAllocationAction({
        businessId,
        transactionId,
        amount: row.amount.trim(),
        entryType: row.entryType,
        streamKey: row.streamKey.trim() || undefined,
        tariff: row.tariff.trim() || undefined,
        note: row.note.trim() || undefined,
      });
      if (!result.ok) {
        setIsSubmitting(false);
        setError(
          result.formError === "over_allocated"
            ? t("business.allocation.error.over_allocated")
            : t("forms.common.form_error.internal"),
        );
        return;
      }
    }
    setIsSubmitting(false);
    onSuccess?.();
  }

  const entryTypeOptions = [
    { value: BusinessEntryType.REVENUE, label: t("business.allocation.entry_type.revenue") },
    { value: BusinessEntryType.PASS_THROUGH, label: t("business.allocation.entry_type.pass_through") },
  ];

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <p className="field-hint">
        {t("business.allocation.split.txn_amount_hint", {
          vars: { amount: formatMoney(txnAmount, currencyCode) },
        })}
      </p>

      {rows.map((row) => (
        <div key={row.key} className="field" style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--sp-2)" }}>
          <div className="form-row">
            <div className="field">
              <label className="form-label" htmlFor={`amount-${row.key}`}>
                {t("business.allocation.field.amount")}
              </label>
              <div className="money-input-wrap">
                <input
                  id={`amount-${row.key}`}
                  type="text"
                  inputMode="decimal"
                  className="money-input"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                />
                <span className="money-input-currency" aria-label={currencyCode}>
                  {currencyCode}
                </span>
              </div>
            </div>
            <div className="field">
              <label className="form-label" htmlFor={`entry-${row.key}`}>
                {t("business.allocation.field.entry_type")}
              </label>
              <select
                id={`entry-${row.key}`}
                value={row.entryType}
                onChange={(e) => updateRow(row.key, { entryType: e.target.value as BusinessEntryType })}
              >
                {entryTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="form-label" htmlFor={`stream-${row.key}`}>
                {t("business.allocation.field.stream_key")}
              </label>
              <input
                id={`stream-${row.key}`}
                type="text"
                value={row.streamKey}
                onChange={(e) => updateRow(row.key, { streamKey: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="form-label" htmlFor={`tariff-${row.key}`}>
                {t("business.allocation.field.tariff")}
              </label>
              <input
                id={`tariff-${row.key}`}
                type="text"
                value={row.tariff}
                onChange={(e) => updateRow(row.key, { tariff: e.target.value })}
              />
            </div>
          </div>

          {rows.length > 1 && (
            <button
              type="button"
              className="btn-ghost btn-xs"
              onClick={() => removeRow(row.key)}
            >
              {t("business.allocation.split.remove_row")}
            </button>
          )}
        </div>
      ))}

      <button type="button" className="btn btn-xs" onClick={addRow}>
        {t("business.allocation.split.add_row")}
      </button>

      <div
        className="mono"
        style={{
          fontSize: "var(--text-sm)",
          color: isOverAllocated ? "var(--neg)" : "var(--muted)",
          padding: "var(--sp-2) 0",
        }}
      >
        {t("business.allocation.split.remainder", {
          vars: { amount: formatMoney(remainder.abs(), currencyCode) },
        })}
        {isOverAllocated && ` — ${t("business.allocation.error.over_allocated")}`}
      </div>

      {error && (
        <span className="field-error submit-row-error" role="alert">
          {error}
        </span>
      )}

      <div className="submit-row">
        <div className="submit-row-actions">
          {onSuccess && (
            <button type="button" className="btn-ghost" onClick={onSuccess} disabled={isSubmitting}>
              {t("forms.common.cancel")}
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={isSubmitting || isOverAllocated}>
            {isSubmitting ? "..." : t("forms.common.save")}
          </button>
        </div>
      </div>
    </form>
  );
}
