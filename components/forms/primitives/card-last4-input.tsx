"use client";

import React, { useRef, useState } from "react";
import { useT } from "@/lib/i18n";

interface CardLast4InputProps {
  chips: string[];
  onChange: (chips: string[]) => void;
}

export function CardLast4Input({ chips, onChange }: CardLast4InputProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  function tryCommit(raw: string) {
    const val = raw.trim();
    if (!val) return;

    if (!/^\d{4}$/.test(val)) {
      setInputError(t("forms.account.cardLast4.error.format"));
      return;
    }

    if (chips.includes(val)) {
      setInputError(t("forms.account.cardLast4.error.duplicate"));
      return;
    }

    setInputError(null);
    setInputValue("");
    onChange([...chips, val]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      tryCommit(inputValue);
    }
  }

  function handleBlur() {
    if (inputValue.trim()) {
      tryCommit(inputValue);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip non-digits immediately, max 4 chars
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 4);
    setInputValue(cleaned);
    if (inputError) setInputError(null);
  }

  function removeChip(last4: string) {
    onChange(chips.filter((c) => c !== last4));
  }

  return (
    <div className="field">
      <label className="form-label" htmlFor="card-last4-input">
        {t("forms.account.cardLast4.label")}
      </label>

      {chips.length > 0 && (
        <div className="card-last4-chips" aria-label={t("forms.account.cardLast4.label")}>
          {chips.map((last4) => (
            <span key={last4} className="card-last4-chip">
              {last4}
              <button
                type="button"
                className="card-last4-chip__remove"
                aria-label={t("forms.account.cardLast4.chip_remove_aria", { vars: { last4 } })}
                onClick={() => removeChip(last4)}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        id="card-last4-input"
        type="text"
        inputMode="numeric"
        maxLength={4}
        pattern="\d{4}"
        value={inputValue}
        placeholder={t("forms.account.cardLast4.placeholder")}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoComplete="off"
      />

      {inputError && (
        <span className="field-error" role="alert">
          {inputError}
        </span>
      )}

      <p className="card-last4-hint">{t("forms.account.cardLast4.hint")}</p>
    </div>
  );
}
