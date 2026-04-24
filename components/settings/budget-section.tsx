"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n";
import { updateBudgetSettingsAction } from "@/app/(shell)/settings/actions";
import type { BudgetMode } from "@prisma/client";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";

type Props = {
  activeMode: BudgetMode;
  primaryCurrencyCode: string;
};

const MODES: { id: BudgetMode; labelKey: "settings.budget.mode_economy" | "settings.budget.mode_normal" | "settings.budget.mode_free" }[] = [
  { id: "ECONOMY", labelKey: "settings.budget.mode_economy" },
  { id: "NORMAL",  labelKey: "settings.budget.mode_normal" },
  { id: "FREE",    labelKey: "settings.budget.mode_free" },
];

export function BudgetSection({ activeMode, primaryCurrencyCode }: Props) {
  const t = useT();
  const [mode, setMode] = useState<BudgetMode>(activeMode);
  const [currency, setCurrency] = useState(primaryCurrencyCode);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const segRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useLayoutEffect(() => {
    const seg = segRef.current;
    const btn = btnRefs.current[mode];
    if (!seg || !btn) return;
    const segR = seg.getBoundingClientRect();
    const btnR = btn.getBoundingClientRect();
    seg.style.setProperty("--seg-w", `${btnR.width}px`);
    seg.style.setProperty("--seg-x", `${btnR.left - segR.left - 2}px`);
    seg.style.setProperty("--seg-color", "var(--accent)");
  }, [mode]);

  function save(newMode: BudgetMode, newCurrency: string) {
    setSaved(false);
    setError(null);
    const fd = new FormData();
    fd.set("activeMode", newMode);
    fd.set("primaryCurrencyCode", newCurrency);
    startTransition(async () => {
      const result = await updateBudgetSettingsAction(fd);
      if (result?.error) {
        setError(t("settings.budget.error_save"));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  function handleModeClick(m: BudgetMode) {
    setMode(m);
    save(m, currency);
  }

  function handleCurrencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const c = e.target.value;
    setCurrency(c);
    save(mode, c);
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title mono">
        {t("settings.budget.section_title")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="settings-field-row">
          <span className="settings-field-label mono">
            {t("settings.budget.mode_label")}
          </span>
          <div className="seg" ref={segRef}>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                ref={(el) => { btnRefs.current[m.id] = el; }}
                className={mode === m.id ? "on" : undefined}
                aria-pressed={mode === m.id}
                onClick={() => handleModeClick(m.id)}
                disabled={isPending}
              >
                {t(m.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-field-row">
          <label className="settings-field-label mono" htmlFor="budget-currency">
            {t("settings.budget.currency_label")}
          </label>
          <select
            id="budget-currency"
            className="settings-select mono"
            value={currency}
            onChange={handleCurrencyChange}
            disabled={isPending}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.symbol}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {saved && (
            <span className="mono" style={{ fontSize: 11, color: "var(--pos)" }}>
              {t("settings.budget.saved")}
            </span>
          )}
          {error && (
            <span className="mono" style={{ fontSize: 11, color: "var(--neg)" }}>
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
