"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import type { TKey, TOptions } from "@/lib/i18n";
import type { ImportPreview, ImportPreviewRow, ImportSource } from "@/lib/import/types";
import type { GenericMapping } from "@/lib/import/types";
import { getCsvHeaders, getCsvPreviewRows, guessGenericMapping } from "@/lib/import/parsers/generic";

type Account = { id: string; name: string; currencyCode: string };
type Category = { id: string; name: string; kind: string };

type Step = "upload" | "preview" | "result";

type ConfirmResult = {
  created: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
};

interface ImportWizardProps {
  accounts: Account[];
  categories: Category[];
  locale: string;
}

export function ImportWizard({ accounts, categories }: ImportWizardProps) {
  const t = useT();
  const router = useRouter();

  const [step, setStep] = useState<Step>("upload");

  // Upload step state
  const [source, setSource] = useState<ImportSource>("tinkoff");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [csvText, setCsvText] = useState("");
  const [encoding, setEncoding] = useState<"utf-8" | "windows-1251">("utf-8");
  const [delimiter, setDelimiter] = useState<";" | ",">(";");

  // Generic mapping state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvSampleRows, setCsvSampleRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<GenericMapping>>({});

  // Preview step state
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rowStates, setRowStates] = useState<
    Array<{ included: boolean; selectedCategoryId: string | null }>
  >([]);

  // Result step state
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle CSV text paste / file load
  const handleCsvChange = useCallback(
    (text: string) => {
      setCsvText(text);
      if (source === "generic" && text.trim()) {
        const detectedDelimiter = text.includes(";") ? ";" : ",";
        const headers = getCsvHeaders(text, detectedDelimiter);
        const samples = getCsvPreviewRows(text, detectedDelimiter, 3);
        setCsvHeaders(headers);
        setCsvSampleRows(samples);
        const guessed = guessGenericMapping(headers);
        setMapping(guessed);
        setDelimiter(detectedDelimiter);
      }
    },
    [source],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const decoder =
        encoding === "windows-1251"
          ? new TextDecoder("windows-1251")
          : new TextDecoder("utf-8");

      const buffer = await file.arrayBuffer();
      const text = decoder.decode(buffer);
      handleCsvChange(text);
    },
    [encoding, handleCsvChange],
  );

  const handleNext = useCallback(async () => {
    setError(null);
    if (!csvText.trim()) {
      setError(t("import.error.no_csv"));
      return;
    }
    if (!accountId) {
      setError(t("import.error.no_account"));
      return;
    }

    const body: Record<string, unknown> = {
      accountId,
      source,
      csv: csvText,
      options: {
        delimiter,
        encoding,
        ...(source === "generic" && mapping.date && mapping.amount
          ? { mapping: { ...mapping, delimiter } }
          : {}),
      },
    };

    if (source === "generic" && (!mapping.date || !mapping.amount)) {
      setError(t("import.error.mapping_incomplete"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/transactions/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("forms.common.form_error.internal"));
        return;
      }
      const p: ImportPreview = json.data;
      setPreview(p);
      setRowStates(
        p.rows.map((r) => ({
          included: r.included,
          selectedCategoryId: r.selectedCategoryId ?? null,
        })),
      );
      setStep("preview");
    } catch {
      setError(t("forms.common.form_error.internal"));
    } finally {
      setLoading(false);
    }
  }, [csvText, accountId, source, delimiter, encoding, mapping, t]);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);

    const includedIndices: number[] = [];
    const categoryMapping: Record<string, string | null> = {};

    rowStates.forEach((rs, i) => {
      if (rs.included) {
        includedIndices.push(i);
        categoryMapping[String(i)] = rs.selectedCategoryId;
      }
    });

    try {
      const res = await fetch("/api/transactions/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          rows: preview.rows,
          categoryMapping,
          includedIndices,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("forms.common.form_error.internal"));
        return;
      }
      setResult(json.data);
      setStep("result");
    } catch {
      setError(t("forms.common.form_error.internal"));
    } finally {
      setLoading(false);
    }
  }, [preview, rowStates, accountId, t]);

  const includedCount = rowStates.filter((r) => r.included).length;

  return (
    <div className="import-wizard">
      {/* Step header */}
      <div className="import-steps">
        <span className={step === "upload" ? "import-step active" : "import-step"}>
          1 · {t("import.step_upload")}
        </span>
        <span className="import-step-sep">/</span>
        <span className={step === "preview" ? "import-step active" : "import-step"}>
          2 · {t("import.step_preview")}
        </span>
        <span className="import-step-sep">/</span>
        <span className={step === "result" ? "import-step active" : "import-step"}>
          3 · {t("import.step_result")}
        </span>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="import-body">
          <div className="import-grid">
            {/* Source select */}
            <div className="field">
              <label className="form-label">{t("import.source.label")}</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as ImportSource)}
              >
                <option value="tinkoff">{t("import.source.tinkoff")}</option>
                <option value="generic">{t("import.source.generic")}</option>
              </select>
            </div>

            {/* Account select */}
            <div className="field">
              <label className="form-label">{t("forms.tx.field.account")}</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currencyCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Tinkoff-specific: encoding */}
            {source === "tinkoff" && (
              <div className="field">
                <label className="form-label">{t("import.encoding.label")}</label>
                <select
                  value={encoding}
                  onChange={(e) => setEncoding(e.target.value as "utf-8" | "windows-1251")}
                >
                  <option value="utf-8">{t("import.encoding.utf8")}</option>
                  <option value="windows-1251">{t("import.encoding.win1251")}</option>
                </select>
              </div>
            )}

            {/* Generic-specific: delimiter */}
            {source === "generic" && (
              <div className="field">
                <label className="form-label">{t("import.delimiter.label")}</label>
                <select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value as ";" | ",")}
                >
                  <option value=";">{t("import.delimiter.semicolon")}</option>
                  <option value=",">{t("import.delimiter.comma")}</option>
                </select>
              </div>
            )}
          </div>

          {/* File input */}
          <div className="field">
            <label className="form-label">{t("import.file.label")}</label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="import-file-input"
            />
          </div>

          {/* Textarea fallback */}
          <div className="field">
            <label className="form-label">{t("import.csv_paste.label")}</label>
            <textarea
              className="import-textarea"
              placeholder={t("import.csv_paste.placeholder")}
              value={csvText}
              onChange={(e) => handleCsvChange(e.target.value)}
              rows={6}
            />
          </div>

          {/* Generic column mapping */}
          {source === "generic" && csvHeaders.length > 0 && (
            <div className="import-section">
              <div className="import-section-title">{t("import.mapping.title")}</div>

              {/* Sample preview */}
              <div className="import-sample">
                <table className="import-table import-table-sm">
                  <thead>
                    <tr>
                      {csvHeaders.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvSampleRows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="import-mapping-grid">
                <MappingSelect
                  label={t("import.mapping.date")}
                  value={mapping.date ?? ""}
                  headers={csvHeaders}
                  required
                  onChange={(v) => setMapping((m) => ({ ...m, date: v || undefined }))}
                />
                <MappingSelect
                  label={t("import.mapping.amount")}
                  value={mapping.amount ?? ""}
                  headers={csvHeaders}
                  required
                  onChange={(v) => setMapping((m) => ({ ...m, amount: v || undefined }))}
                />
                <MappingSelect
                  label={t("import.mapping.currency")}
                  value={mapping.currency ?? ""}
                  headers={csvHeaders}
                  onChange={(v) => setMapping((m) => ({ ...m, currency: v || undefined }))}
                />
                <MappingSelect
                  label={t("import.mapping.category")}
                  value={mapping.category ?? ""}
                  headers={csvHeaders}
                  onChange={(v) => setMapping((m) => ({ ...m, category: v || undefined }))}
                />
                <MappingSelect
                  label={t("import.mapping.description")}
                  value={mapping.description ?? ""}
                  headers={csvHeaders}
                  onChange={(v) => setMapping((m) => ({ ...m, description: v || undefined }))}
                />
              </div>
            </div>
          )}

          {error && <div className="import-error">{error}</div>}

          <div className="import-actions">
            <button
              type="button"
              className="btn primary"
              onClick={handleNext}
              disabled={loading || !csvText.trim()}
            >
              {loading ? t("forms.common.loading") : t("import.next")}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && preview && (
        <div className="import-body">
          <div className="import-stats">
            <span className="import-stat">
              <span className="import-stat-k">{t("import.preview.total")}</span>
              <span className="import-stat-v">{preview.stats.total}</span>
            </span>
            <span className="import-stat">
              <span className="import-stat-k">{t("import.preview.duplicate")}</span>
              <span className="import-stat-v">{preview.stats.duplicates}</span>
            </span>
            <span className="import-stat">
              <span className="import-stat-k">{t("import.preview.will_import")}</span>
              <span className="import-stat-v import-stat-acc">{includedCount}</span>
            </span>
          </div>

          {preview.warnings.length > 0 && (
            <div className="import-warnings">
              {preview.warnings.slice(0, 5).map((w, i) => (
                <div key={i} className="import-warning">
                  {formatWarning(w)}
                </div>
              ))}
              {preview.warnings.length > 5 && (
                <div className="import-warning dim">
                  +{preview.warnings.length - 5} {t("import.warning.more")}
                </div>
              )}
            </div>
          )}

          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th>{t("import.preview.included")}</th>
                  <th>{t("forms.tx.field.occurred_at")}</th>
                  <th>{t("forms.tx.field.amount")}</th>
                  <th>{t("forms.common.kind.income")}/{t("forms.common.kind.expense")}</th>
                  <th>{t("forms.tx.field.name")}</th>
                  <th>{t("forms.tx.field.category")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 500).map((row, i) => (
                  <PreviewRow
                    key={i}
                    row={row}
                    index={i}
                    included={rowStates[i]?.included ?? row.included}
                    selectedCategoryId={rowStates[i]?.selectedCategoryId ?? row.selectedCategoryId ?? null}
                    categories={categories}
                    onToggle={(idx) =>
                      setRowStates((prev) =>
                        prev.map((s, si) =>
                          si === idx ? { ...s, included: !s.included } : s,
                        ),
                      )
                    }
                    onCategoryChange={(idx, catId) =>
                      setRowStates((prev) =>
                        prev.map((s, si) =>
                          si === idx ? { ...s, selectedCategoryId: catId } : s,
                        ),
                      )
                    }
                    t={t}
                  />
                ))}
              </tbody>
            </table>
            {preview.rows.length > 500 && (
              <div className="import-warning dim" style={{ padding: "6px 12px" }}>
                {t("import.preview.truncated_hint", { vars: { n: String(preview.rows.length) } })}
              </div>
            )}
          </div>

          {error && <div className="import-error">{error}</div>}

          <div className="import-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setStep("upload")}
              disabled={loading}
            >
              {t("import.back")}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleConfirm}
              disabled={loading || includedCount === 0}
            >
              {loading
                ? t("forms.common.loading")
                : t("import.confirm.button", { vars: { n: String(includedCount) } })}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && result && (
        <div className="import-body">
          <div className="import-result">
            <div className="import-result-title">{t("import.result.title")}</div>
            <div className="import-result-stats">
              <div className="import-result-row">
                <span className="import-result-k">{t("import.result.created")}</span>
                <span className="import-result-v pos">{result.created}</span>
              </div>
              <div className="import-result-row">
                <span className="import-result-k">{t("import.result.skipped")}</span>
                <span className="import-result-v mut">{result.skipped}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="import-result-row">
                  <span className="import-result-k">{t("import.result.errors")}</span>
                  <span className="import-result-v neg">{result.errors.length}</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="import-warnings">
                {result.errors.slice(0, 5).map((e, i) => (
                  <div key={i} className="import-warning">
                    row {e.index}: {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="import-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => router.push("/transactions")}
            >
              {t("import.result.go_transactions")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function MappingSelect({
  label,
  value,
  headers,
  required,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  required?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label className="form-label">
        {label}
        {required && <span> *</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

function PreviewRow({
  row,
  index,
  included,
  selectedCategoryId,
  categories,
  onToggle,
  onCategoryChange,
  t,
}: {
  row: ImportPreviewRow;
  index: number;
  included: boolean;
  selectedCategoryId: string | null;
  categories: Category[];
  onToggle: (idx: number) => void;
  onCategoryChange: (idx: number, catId: string | null) => void;
  t: (key: TKey, opts?: TOptions) => string;
}) {
  const dateStr = row.occurredAt
    ? new Date(row.occurredAt).toLocaleDateString("ru-RU")
    : "—";
  const name = row.description ?? row.rawCategory ?? "—";
  const kindClass = row.kind === "INCOME" ? "pos" : "info";

  const filteredCats = categories.filter((c) => c.kind === row.kind);

  return (
    <tr className={row.isDuplicate ? "import-row-dup" : included ? "" : "import-row-excluded"}>
      <td>
        <input
          type="checkbox"
          checked={included}
          onChange={() => onToggle(index)}
        />
      </td>
      <td className="mono">{dateStr}</td>
      <td className={`mono ${kindClass}`}>
        {row.kind === "INCOME" ? "+" : "-"}{row.amount} {row.currencyCode}
        {row.isDuplicate && (
          <span className="import-dup-badge" title={t("import.preview.duplicate_hint")}>
            dup
          </span>
        )}
      </td>
      <td className={`import-kind-badge ${kindClass}`}>
        {row.kind === "INCOME" ? t("forms.common.kind.income") : t("forms.common.kind.expense")}
      </td>
      <td className="import-name" title={name}>{name.substring(0, 40)}</td>
      <td>
        <select
          value={selectedCategoryId ?? ""}
          onChange={(e) => onCategoryChange(index, e.target.value || null)}
          className="import-cat-select"
        >
          <option value="">—</option>
          {filteredCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

function formatWarning(w: string): string {
  // Human-readable format for warning codes
  if (w.startsWith("skipped:")) return w.replace("skipped:", "").replace(/_/g, " ");
  if (w.startsWith("bad_row:")) return w.replace("bad_row:", "row ").replace(/:/, ": ");
  if (w.startsWith("parse_error:")) return "Parse error: " + w.split(":").slice(2).join(":");
  return w;
}
