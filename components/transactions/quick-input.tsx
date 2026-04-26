"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "@/lib/i18n";
import { formatPlainNumber } from "@/lib/format/money";
import {
  parseOneLiner,
  type ParsedTransaction,
  type ParseWarning,
} from "@/lib/transactions/parse-one-liner";
import { createTransactionFromOneLinerAction } from "@/app/(shell)/transactions/actions";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CategoryOption {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
}

export interface QuickInputProps {
  variant: "home" | "toolbar";
  defaultAccountId?: string;
  defaultCurrency?: string;
  categories?: CategoryOption[];
  accountName?: string;
}

// ─────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────

function formatAmountStr(amountStr: string): string {
  const n = parseFloat(amountStr);
  if (isNaN(n)) return amountStr;
  return formatPlainNumber(n);
}

// Build /transactions/new href passing all parsed params so the full form
// is pre-filled with whatever the one-liner already understood.
function buildFullFormHref(
  parsed: ParsedTransaction | null,
  input: string,
): string {
  const params = new URLSearchParams();

  if (parsed) {
    params.set("kind", parsed.kind);
    params.set("amount", parsed.amount);
    params.set("currency", parsed.currencyCode);
    params.set("date", parsed.date);
    const desc = parsed.description || parsed.raw;
    if (desc) params.set("description", desc);
    if (parsed.categoryId) params.set("category", parsed.categoryId);
  } else {
    if (input) params.set("description", input);
  }

  return `/transactions/new?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function QuickInput({
  variant,
  defaultAccountId,
  defaultCurrency,
  categories,
  accountName,
}: QuickInputProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [parseError, setParseError] = useState<"no_amount" | "empty" | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Re-parse on every input change
  useEffect(() => {
    if (!input.trim()) {
      setParsed(null);
      setParseError(null);
      return;
    }

    const result = parseOneLiner(input, {
      accountCurrency: defaultCurrency,
      locale,
      categories: categories as Array<{
        id: string;
        name: string;
        kind: "INCOME" | "EXPENSE";
      }>,
      now: new Date(),
    });

    if ("error" in result) {
      setParsed(null);
      setParseError(result.error);
    } else {
      setParsed(result);
      setParseError(null);
    }
  }, [input, defaultCurrency, locale, categories]);

  // Hotkey Q — focus input (ignore when target is editable)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (e.key === "Q" || e.key === "q") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleClear = useCallback(() => {
    setInput("");
    setParsed(null);
    setParseError(null);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!parsed || !defaultAccountId || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createTransactionFromOneLinerAction({
        accountId: defaultAccountId,
        amount: parsed.amount,
        currencyCode: parsed.currencyCode,
        kind: parsed.kind,
        occurredAt: new Date(parsed.date),
        name: parsed.description || parsed.categoryGuess || parsed.raw,
        categoryId: parsed.categoryId ?? undefined,
      });

      if ("ok" in result && result.ok) {
        setSubmitSuccess(true);
        handleClear();
        // Brief success flash before reset
        setTimeout(() => setSubmitSuccess(false), 1500);
      } else {
        setSubmitError(t("quick_input.error.invalid"));
      }
    } catch {
      setSubmitError(t("quick_input.error.invalid"));
    } finally {
      setSubmitting(false);
    }
  }, [parsed, defaultAccountId, submitting, handleClear, t]);

  // Keyboard handling inside the input
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (parsed && defaultAccountId) {
          void handleSubmit();
        }
      }
      if (e.key === "Escape") {
        handleClear();
        inputRef.current?.blur();
      }
    },
    [parsed, defaultAccountId, handleSubmit, handleClear],
  );

  // No active accounts — show placeholder
  if (!defaultAccountId) {
    return (
      <div className="qi-root qi-no-accounts">
        <span className="mut">{t("quick_input.no_accounts")}</span>
      </div>
    );
  }

  const hasInput = input.trim().length > 0;
  const showPreview = hasInput && parsed !== null;
  const showError = hasInput && parseError === "no_amount";
  const isIncome = parsed?.kind === "INCOME";

  const warningKeys: Array<{
    key: ParseWarning;
    label: string;
  }> = (parsed?.warnings ?? []).map((w) => ({
    key: w,
    label: t(`quick_input.warning.${w}` as Parameters<typeof t>[0]),
  }));

  return (
    <div className={`qi-root qi-variant-${variant}`}>
      {/* Input row */}
      <div className="qi-input-row">
        <input
          ref={inputRef}
          className="qi-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={t("quick_input.placeholder")}
          aria-label={t("quick_input.title")}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={submitting}
        />
        <span className="qi-hotkey-hint k">{t("quick_input.hotkey_hint")}</span>
      </div>

      {/* Preview */}
      {showPreview && parsed && (
        <div className="qi-preview">
          <div className="qi-preview-chips">
            <span className={`qi-chip-kind ${isIncome ? "inc" : "exp"}`}>
              {t(isIncome ? "quick_input.kind.income" : "quick_input.kind.expense")}
            </span>
            <span className="qi-chip-amount mono">
              {formatAmountStr(parsed.amount)}{" "}
              <span className="mut">{parsed.currencyCode}</span>
            </span>
            {parsed.categoryGuess && !parsed.warnings.includes("category_kind_mismatch") && (
              <span className="qi-chip-cat mut">{parsed.categoryGuess}</span>
            )}
            <span className="qi-chip-date mut">{parsed.dateLabel}</span>
            {accountName && (
              <span className="qi-chip-account dim">{accountName}</span>
            )}
          </div>

          {/* Warnings */}
          {warningKeys.length > 0 && (
            <div className="qi-warnings">
              {warningKeys.map(({ key, label }) => (
                <span key={key} className="qi-warning">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No-amount error */}
      {showError && (
        <div className="qi-error-row">
          <span className="qi-error-msg neg">
            {t("quick_input.error.no_amount")}
          </span>
          <a
            className="qi-open-full btn"
            href={buildFullFormHref(null, input)}
            onClick={(e) => {
              e.preventDefault();
              router.push(buildFullFormHref(null, input));
            }}
          >
            {t("quick_input.open_full")}
          </a>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="qi-error-row">
          <span className="qi-error-msg neg">{submitError}</span>
        </div>
      )}

      {/* Success flash */}
      {submitSuccess && (
        <div className="qi-success-row">
          <span className="qi-success-msg acc">{t("quick_input.confirm")}</span>
        </div>
      )}

      {/* Action buttons */}
      {showPreview && parsed && (
        <div className="qi-actions">
          <button
            type="button"
            className="btn primary qi-btn-confirm"
            disabled={submitting || !defaultAccountId}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "…" : t("quick_input.confirm")}
          </button>
          <a
            className="qi-btn-full btn"
            href={buildFullFormHref(parsed, input)}
            onClick={(e) => {
              e.preventDefault();
              router.push(buildFullFormHref(parsed, input));
            }}
          >
            {t("quick_input.open_full")}
          </a>
          {hasInput && (
            <button
              type="button"
              className="qi-btn-clear btn"
              onClick={handleClear}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
