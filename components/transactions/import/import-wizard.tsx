"use client";

import React, { useState, useCallback, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import type { TKey, TOptions } from "@/lib/i18n";
import type { ImportPreview, ImportPreviewRow, ImportSource } from "@/lib/import/types";
import type { GenericMapping } from "@/lib/import/types";
import { getCsvHeaders, getCsvPreviewRows, guessGenericMapping } from "@/lib/import/parsers/generic";
import { updateAccountAction } from "@/app/(shell)/wallet/actions";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Account = { id: string; name: string; currencyCode: string; cardLast4?: string[] };
type Category = { id: string; name: string; kind: string };

type Step = "files" | "preview" | "result";

type FileEntry = {
  id: string;
  filename: string;
  csvText: string;
  rowCount: number;
  accountId: string;
  source: ImportSource;
  encoding?: "utf-8" | "windows-1251";
  delimiter?: ";" | ",";
  mapping?: Partial<GenericMapping>;
};

type ConfirmResult = {
  created: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
  transfersCreated?: number;
};

interface ImportWizardProps {
  accounts: Account[];
  categories: Category[];
  locale: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function estimateRowCount(csv: string): number {
  // Cheap estimate: count newlines minus header
  const lines = csv.split("\n").filter((l) => l.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function ImportWizard({ accounts, categories }: ImportWizardProps) {
  const t = useT();
  const router = useRouter();

  const [step, setStep] = useState<Step>("files");

  // Step 1 — files state
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — preview state
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rowStates, setRowStates] = useState<
    Array<{ included: boolean; selectedCategoryId: string | null }>
  >([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Step 3 — result state
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Shared error
  const [error, setError] = useState<string | null>(null);

  // Card-hint bind pending
  const [bindingCard, startBindTransition] = useTransition();
  const [boundCards, setBoundCards] = useState<Set<string>>(new Set());

  // ── File reading helper ──────────────────────────────────────

  async function readFileAsText(
    file: File,
    encoding: "utf-8" | "windows-1251",
  ): Promise<string> {
    const decoder =
      encoding === "windows-1251"
        ? new TextDecoder("windows-1251")
        : new TextDecoder("utf-8");
    const buffer = await file.arrayBuffer();
    return decoder.decode(buffer);
  }

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newEntries: FileEntry[] = [];
      for (const file of Array.from(fileList)) {
        if (!file.name.match(/\.(csv|txt)$/i)) continue;

        // Guess encoding from filename — Tinkoff often ships windows-1251
        const guessedEncoding: "utf-8" | "windows-1251" = "utf-8";
        const text = await readFileAsText(file, guessedEncoding);
        const guessedDelimiter: ";" | "," = text.includes(";") ? ";" : ",";
        const guessedSource: ImportSource = file.name.toLowerCase().includes("tinkoff")
          ? "tinkoff"
          : "generic";

        const headers = getCsvHeaders(text, guessedDelimiter);
        const mapping = guessGenericMapping(headers);

        newEntries.push({
          id: crypto.randomUUID(),
          filename: file.name,
          csvText: text,
          rowCount: estimateRowCount(text),
          accountId: accounts[0]?.id ?? "",
          source: guessedSource,
          encoding: guessedEncoding,
          delimiter: guessedDelimiter,
          mapping,
        });
      }
      setFiles((prev) => [...prev, ...newEntries]);
    },
    [accounts],
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        await addFiles(e.target.files);
        // Reset input so same file can be re-added after removal
        e.target.value = "";
      }
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        await addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const updateFile = useCallback(
    <K extends keyof FileEntry>(id: string, key: K, value: FileEntry[K]) => {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
    },
    [],
  );

  // ── Step navigation ──────────────────────────────────────────

  const canGoNext = files.length > 0 && files.every((f) => f.accountId !== "");

  const runPreview = useCallback(
    async (currentFiles: FileEntry[]) => {
      setPreviewLoading(true);
      setError(null);
      try {
        const body = {
          files: currentFiles.map((f) => ({
            filename: f.filename,
            accountId: f.accountId,
            source: f.source,
            csv: f.csvText,
            options:
              f.source === "generic"
                ? {
                    delimiter: f.delimiter,
                    encoding: f.encoding,
                    ...(f.mapping?.date && f.mapping?.amount
                      ? { mapping: { ...f.mapping, delimiter: f.delimiter } }
                      : {}),
                  }
                : {
                    delimiter: f.delimiter,
                    encoding: f.encoding,
                  },
          })),
        };

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
        setPreviewLoading(false);
      }
    },
    [t],
  );

  const handleNext = useCallback(async () => {
    await runPreview(files);
  }, [files, runPreview]);

  const handleBack = useCallback(() => {
    setStep("files");
    setPreview(null);
    setError(null);
  }, []);

  // ── Card hint binding ─────────────────────────────────────────

  const handleBindCard = useCallback(
    (last4: string, accountId: string, currentCardLast4: string[]) => {
      const newCardLast4 = [...currentCardLast4.filter((c) => c !== last4), last4];
      startBindTransition(async () => {
        const res = await updateAccountAction(accountId, { cardLast4: newCardLast4 });
        if (res.ok) {
          setBoundCards((prev) => new Set([...prev, last4]));
          // Re-run preview to get updated card hints
          await runPreview(files);
        }
      });
    },
    [files, runPreview],
  );

  // ── Confirm ──────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setConfirmLoading(true);
    setError(null);

    const includedIndices: number[] = [];

    // Build rows with per-row selectedCategoryId merged from rowStates
    const rowsWithCategories = preview.rows.map((row, i) => {
      const rs = rowStates[i];
      return {
        ...row,
        included: rs?.included ?? row.included,
        selectedCategoryId: rs?.selectedCategoryId ?? row.selectedCategoryId ?? null,
      };
    });

    rowStates.forEach((rs, i) => {
      if (rs.included) {
        includedIndices.push(i);
      }
    });

    try {
      const res = await fetch("/api/transactions/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsWithCategories,
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
      setConfirmLoading(false);
    }
  }, [preview, rowStates, t]);

  // ── Derived values for step 2 ────────────────────────────────

  const includedCount = rowStates.filter((r) => r.included).length;
  const pairedTransferCount = preview?.stats.paired ?? 0;

  // Collect unique card hints across all rows
  const cardHints = React.useMemo(() => {
    if (!preview) return [];
    const seen = new Map<string, { last4: string; suggestedAccountId?: string; targetAccountId: string }>();
    for (const row of preview.rows) {
      if (!row.cardHint) continue;
      const { last4, suggestedAccountId } = row.cardHint;
      if (!seen.has(last4)) {
        seen.set(last4, { last4, suggestedAccountId, targetAccountId: row.accountId });
      }
    }
    return Array.from(seen.values());
  }, [preview]);

  // Intra-skipped rows
  const intraSkippedRows = React.useMemo(() => {
    if (!preview) return [];
    return preview.rows.filter((r) => r.pairStatus === "intra-account-skipped");
  }, [preview]);

  // Main preview rows (exclude intra-skipped)
  const mainRows = React.useMemo(() => {
    if (!preview) return [];
    return preview.rows
      .map((r, i) => ({ row: r, index: i }))
      .filter(({ row }) => row.pairStatus !== "intra-account-skipped");
  }, [preview]);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="import-wizard">
      {/* Step header */}
      <div className="import-steps">
        <span className={step === "files" ? "import-step active" : "import-step"}>
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

      {/* ── Step 1: Files ───────────────────────────────────────── */}
      {step === "files" && (
        <div className="import-body">
          {/* Drop zone */}
          <div
            className={`import-dropzone${dragOver ? " drag-over" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <span className="btn">{t("import.files.add")}</span>
            <div className="import-dropzone-hint">{t("import.files.drop_hint")}</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            multiple
            style={{ display: "none" }}
            onChange={handleInputChange}
          />

          {/* File list */}
          {files.length > 0 && (
            <div className="import-files-list">
              {files.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  accounts={accounts}
                  onRemove={removeFile}
                  onUpdate={updateFile}
                  t={t}
                />
              ))}
            </div>
          )}

          {error && <div className="import-error">{error}</div>}

          <div className="import-actions">
            <button
              type="button"
              className="btn primary"
              onClick={handleNext}
              disabled={previewLoading || !canGoNext}
            >
              {previewLoading ? t("forms.common.loading") : t("import.next")}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ─────────────────────────────────────── */}
      {step === "preview" && preview && (
        <div className="import-body">
          {/* Stats */}
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
            {preview.stats.paired > 0 && (
              <span className="import-stat">
                <span className="import-stat-k">{t("import.preview.paired_badge")}</span>
                <span className="import-stat-v">{preview.stats.paired}</span>
              </span>
            )}
          </div>

          {/* Card hint banners */}
          {cardHints.length > 0 && (
            <div className="import-cardhint-list">
              {cardHints.map(({ last4, suggestedAccountId, targetAccountId }) => {
                const bindTargetId = suggestedAccountId ?? targetAccountId;
                const bindTargetAccount = preview.accounts.find((a) => a.id === bindTargetId);
                const isBound = boundCards.has(last4);
                const currentCardLast4 = bindTargetAccount?.cardLast4 ?? [];

                return (
                  <div key={last4} className="import-cardhint-item">
                    <span className="import-cardhint-msg">
                      {t("import.cardhint.body", {
                        vars: {
                          last4,
                          account: bindTargetAccount?.name ?? bindTargetId,
                        },
                      })}
                    </span>
                    {isBound ? (
                      <span className="import-badge paired">{t("import.cardhint.bound")}</span>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        disabled={bindingCard}
                        onClick={() => handleBindCard(last4, bindTargetId, currentCardLast4)}
                      >
                        {t("import.cardhint.bind")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Intra-account skipped */}
          {intraSkippedRows.length > 0 && (
            <details className="import-intra-details">
              <summary>
                {t("import.preview.intra_skipped_group", {
                  vars: { n: String(intraSkippedRows.length) },
                })}
              </summary>
              <div className="import-table-wrap" style={{ marginTop: 6 }}>
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>{t("forms.tx.field.occurred_at")}</th>
                      <th>{t("forms.tx.field.amount")}</th>
                      <th>{t("forms.tx.field.name")}</th>
                      <th>{t("import.preview.source_file")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intraSkippedRows.map((row, ri) => {
                      const dateStr = row.occurredAt
                        ? new Date(row.occurredAt).toLocaleDateString("ru-RU")
                        : "—";
                      const name = row.description ?? row.rawCategory ?? "—";
                      return (
                        <tr key={ri} className="import-row-excluded">
                          <td className="mono">{dateStr}</td>
                          <td className="mono mut">{row.amount} {row.currencyCode}</td>
                          <td className="import-name" title={name}>{name.substring(0, 40)}</td>
                          <td>
                            <span className="import-source-chip" title={row.sourceFile}>
                              {row.sourceFile}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="import-warnings">
              {preview.warnings.slice(0, 5).map((w, i) => (
                <div key={i} className="import-warning">
                  {formatWarning(w, t)}
                </div>
              ))}
              {preview.warnings.length > 5 && (
                <div className="import-warning dim">
                  +{preview.warnings.length - 5} {t("import.warning.more")}
                </div>
              )}
            </div>
          )}

          {/* Main table */}
          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th>{t("import.preview.included")}</th>
                  <th>{t("forms.tx.field.occurred_at")}</th>
                  <th>{t("forms.tx.field.amount")}</th>
                  <th>{t("forms.common.kind.income")}/{t("forms.common.kind.expense")}</th>
                  <th>{t("forms.tx.field.name")}</th>
                  <th>{t("import.preview.source_file")}</th>
                  <th>{t("forms.tx.field.category")}</th>
                </tr>
              </thead>
              <tbody>
                {renderMainRows(mainRows, rowStates, categories, setRowStates, t)}
              </tbody>
            </table>
            {preview.rows.length > 500 && (
              <div className="import-warning dim" style={{ padding: "6px 12px" }}>
                {t("import.preview.truncated_hint", {
                  vars: { n: String(preview.rows.length) },
                })}
              </div>
            )}
          </div>

          {error && <div className="import-error">{error}</div>}

          <div className="import-actions">
            <button
              type="button"
              className="btn"
              onClick={handleBack}
              disabled={confirmLoading || previewLoading}
            >
              {t("import.back")}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleConfirm}
              disabled={confirmLoading || previewLoading || includedCount === 0}
            >
              {confirmLoading
                ? t("forms.common.loading")
                : pairedTransferCount > 0
                  ? t("import.confirm.button_with_transfers", {
                      vars: {
                        n: String(includedCount),
                        t: String(pairedTransferCount),
                      },
                    })
                  : t("import.confirm.button", { vars: { n: String(includedCount) } })}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ──────────────────────────────────────── */}
      {step === "result" && result && (
        <div className="import-body">
          <div className="import-result">
            <div className="import-result-title">{t("import.result.title")}</div>
            <div className="import-result-stats">
              <div className="import-result-row">
                <span className="import-result-k">{t("import.result.created")}</span>
                <span className="import-result-v pos">{result.created}</span>
              </div>
              {(result.transfersCreated ?? 0) > 0 && (
                <div className="import-result-row">
                  <span className="import-result-k">
                    {t("import.result.transfers_created", {
                      vars: { n: String(result.transfersCreated) },
                    })}
                  </span>
                  <span className="import-result-v pos">{result.transfersCreated}</span>
                </div>
              )}
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
                    {t("import.result.error_row", {
                      vars: { index: String(e.index), message: e.message },
                    })}
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
// renderMainRows — handles paired-transfer grouping
// ─────────────────────────────────────────────────────────────

function renderMainRows(
  mainRows: Array<{ row: ImportPreviewRow; index: number }>,
  rowStates: Array<{ included: boolean; selectedCategoryId: string | null }>,
  categories: { id: string; name: string; kind: string }[],
  setRowStates: React.Dispatch<
    React.SetStateAction<Array<{ included: boolean; selectedCategoryId: string | null }>>
  >,
  t: (key: TKey, opts?: TOptions) => string,
) {
  const rendered: React.ReactNode[] = [];
  const seen = new Set<number>();

  for (const { row, index } of mainRows) {
    if (seen.has(index)) continue;

    const isPaired = row.pairStatus === "paired-transfer";
    const partnerIndex = row.pairWith;

    if (
      isPaired &&
      partnerIndex !== undefined &&
      partnerIndex !== index
    ) {
      // Find partner in mainRows
      const partnerEntry = mainRows.find((m) => m.index === partnerIndex);

      if (partnerEntry && !seen.has(partnerIndex)) {
        seen.add(index);
        seen.add(partnerIndex);

        rendered.push(
          <tbody key={`pair-${row.pairId ?? index}`} className="import-pair-group">
            <PreviewRow
              row={row}
              index={index}
              included={rowStates[index]?.included ?? row.included}
              selectedCategoryId={null}
              categories={categories}
              isPairLeg
              pairBadge={t("import.preview.paired_badge")}
              onToggle={(idx) =>
                setRowStates((prev) =>
                  prev.map((s, si) =>
                    si === idx ? { ...s, included: !s.included } : s,
                  ),
                )
              }
              onCategoryChange={() => {}}
              t={t}
            />
            <PreviewRow
              row={partnerEntry.row}
              index={partnerEntry.index}
              included={rowStates[partnerEntry.index]?.included ?? partnerEntry.row.included}
              selectedCategoryId={null}
              categories={categories}
              isPairLeg
              pairBadge=""
              onToggle={(idx) =>
                setRowStates((prev) =>
                  prev.map((s, si) =>
                    si === idx ? { ...s, included: !s.included } : s,
                  ),
                )
              }
              onCategoryChange={() => {}}
              t={t}
            />
          </tbody>,
        );
        continue;
      }
    }

    seen.add(index);

    rendered.push(
      <tbody key={`row-${index}`}>
        <PreviewRow
          row={row}
          index={index}
          included={rowStates[index]?.included ?? row.included}
          selectedCategoryId={rowStates[index]?.selectedCategoryId ?? row.selectedCategoryId ?? null}
          categories={categories}
          isPairLeg={false}
          pairBadge=""
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
      </tbody>,
    );
  }

  return rendered;
}

// ─────────────────────────────────────────────────────────────
// FileRow sub-component
// ─────────────────────────────────────────────────────────────

function FileRow({
  file,
  accounts,
  onRemove,
  onUpdate,
  t,
}: {
  file: FileEntry;
  accounts: Account[];
  onRemove: (id: string) => void;
  onUpdate: <K extends keyof FileEntry>(id: string, key: K, value: FileEntry[K]) => void;
  t: (key: TKey, opts?: TOptions) => string;
}) {
  return (
    <div className="import-file-row">
      <div>
        <div className="import-file-name" title={file.filename}>{file.filename}</div>
        <div className="import-file-meta">
          {t("import.files.row_count", { vars: { n: String(file.rowCount) } })}
        </div>
      </div>

      {/* Source format */}
      <div className="field" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: 10, marginBottom: 2 }}>
          {t("import.files.source")}
        </label>
        <select
          value={file.source}
          onChange={(e) => onUpdate(file.id, "source", e.target.value as ImportSource)}
          style={{ fontSize: 11 }}
        >
          <option value="tinkoff">{t("import.source.tinkoff")}</option>
          <option value="generic">{t("import.source.generic")}</option>
        </select>
      </div>

      {/* Target account */}
      <div className="field" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: 10, marginBottom: 2 }}>
          {t("import.files.target_account")}
        </label>
        <select
          value={file.accountId}
          onChange={(e) => onUpdate(file.id, "accountId", e.target.value)}
          style={{ fontSize: 11 }}
        >
          <option value="">—</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currencyCode})
            </option>
          ))}
        </select>
      </div>

      {/* Remove */}
      <button
        type="button"
        className="import-remove-btn"
        title={t("import.files.remove")}
        onClick={() => onRemove(file.id)}
      >
        ×
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MappingSelect
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

// ─────────────────────────────────────────────────────────────
// PreviewRow
// ─────────────────────────────────────────────────────────────

function PreviewRow({
  row,
  index,
  included,
  selectedCategoryId,
  categories,
  isPairLeg,
  pairBadge,
  onToggle,
  onCategoryChange,
  t,
}: {
  row: ImportPreviewRow;
  index: number;
  included: boolean;
  selectedCategoryId: string | null;
  categories: { id: string; name: string; kind: string }[];
  isPairLeg: boolean;
  pairBadge: string;
  onToggle: (idx: number) => void;
  onCategoryChange: (idx: number, catId: string | null) => void;
  t: (key: TKey, opts?: TOptions) => string;
}) {
  const dateStr = row.occurredAt
    ? new Date(row.occurredAt).toLocaleDateString("ru-RU")
    : "—";
  const name = row.description ?? row.rawCategory ?? "—";

  // Use direction to determine sign; fallback to kind
  const isIncome = row.direction === "in";
  const amountPrefix = isPairLeg ? "↔" : isIncome ? "+" : "−";
  const amountClass = isPairLeg ? "mut" : isIncome ? "pos" : "neg";

  const isTransfer = isPairLeg || row.kind === "TRANSFER";
  const isUnpaired = row.pairStatus === "unpaired";
  const filteredCats = isTransfer ? [] : categories.filter((c) => c.kind === row.kind);

  const kindLabel =
    row.kind === "INCOME"
      ? t("forms.common.kind.income")
      : row.kind === "TRANSFER"
        ? t("forms.common.kind.transfer")
        : t("forms.common.kind.expense");

  const kindClass =
    row.kind === "INCOME" ? "pos" : row.kind === "TRANSFER" ? "mut" : "info";

  const rowClass = [
    row.isDuplicate ? "import-row-dup" : "",
    !included ? "import-row-excluded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr className={rowClass}>
      <td>
        <input
          type="checkbox"
          checked={included}
          onChange={() => onToggle(index)}
        />
      </td>
      <td className="mono">{dateStr}</td>
      <td className={`mono ${amountClass}`}>
        {amountPrefix}{row.amount} {row.currencyCode}
        {row.isDuplicate && (
          <span className="import-dup-badge" title={t("import.preview.duplicate_hint")}>
            dup
          </span>
        )}
        {pairBadge && (
          <span className="import-badge paired" style={{ marginLeft: 5 }}>
            {pairBadge}
          </span>
        )}
        {isUnpaired && (
          <span
            className="import-badge unpaired"
            style={{ marginLeft: 5 }}
            title={t("import.preview.unpaired_hint")}
          >
            {t("import.preview.unpaired_badge")}
          </span>
        )}
      </td>
      <td className={`import-kind-badge ${kindClass}`}>{kindLabel}</td>
      <td className="import-name" title={name}>{name.substring(0, 40)}</td>
      <td>
        <span className="import-source-chip" title={row.sourceFile}>
          {row.sourceFile}
        </span>
      </td>
      <td>
        {isTransfer ? (
          <span className="mut import-cat-none">
            {t("import.preview.transfer_no_category")}
          </span>
        ) : (
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
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const KNOWN_PREFIXES = ["parse_error", "bad_row", "skipped", "mapping_required"] as const;

function formatWarning(
  w: string,
  t: (key: TKey, opts?: TOptions) => string,
): string {
  // Warnings arrive as "{filename}:{body}" from the preview route.
  // Find where the body starts by locating the first known prefix segment.
  const parts = w.split(":");
  let prefixIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if ((KNOWN_PREFIXES as readonly string[]).includes(parts[i])) {
      prefixIdx = i;
      break;
    }
  }

  const file = prefixIdx > 0 ? parts.slice(0, prefixIdx).join(":") : null;
  const body = prefixIdx >= 0 ? parts.slice(prefixIdx) : parts;
  const prefix = body[0];

  let formatted: string;
  if (prefix === "parse_error") {
    // parse_error:row<N>:<message>
    const row = body[1]?.replace("row", "") ?? "?";
    const message = body.slice(2).join(":");
    formatted = t("import.warning.parse_error_row", { vars: { row, message } });
  } else if (prefix === "bad_row") {
    // bad_row:row<N>:<reason>:<detail>
    const row = body[1]?.replace("row", "") ?? "?";
    const reason = body.slice(2).join(":");
    formatted = t("import.warning.bad_row_detail", { vars: { row, reason } });
  } else if (prefix === "skipped") {
    // skipped:row<N>:<reason>
    const row = body[1]?.replace("row", "") ?? "?";
    const reason = body.slice(2).join(":").replace(/_/g, " ");
    formatted = t("import.warning.skipped", { vars: { row, reason } });
  } else if (prefix === "mapping_required") {
    formatted = t("import.warning.mapping_required");
  } else {
    // Unknown format — show raw
    formatted = w;
  }

  if (file) {
    return t("import.warning.with_file", { vars: { file, body: formatted } });
  }
  return formatted;
}
