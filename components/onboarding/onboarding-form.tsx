"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n";
import { completeOnboardingAction } from "@/app/onboarding/actions";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import type { BudgetMode, Gender } from "@prisma/client";

const GENDER_OPTIONS: { id: Gender; labelKey: "onboarding.gender.male" | "onboarding.gender.female" | "onboarding.gender.unspecified" }[] = [
  { id: "MALE",        labelKey: "onboarding.gender.male" },
  { id: "FEMALE",      labelKey: "onboarding.gender.female" },
  { id: "UNSPECIFIED", labelKey: "onboarding.gender.unspecified" },
];

const MODE_OPTIONS: {
  id: BudgetMode;
  labelKey: "onboarding.mode.economy" | "onboarding.mode.normal" | "onboarding.mode.free";
  hintKey:  "onboarding.mode.hint_economy" | "onboarding.mode.hint_normal" | "onboarding.mode.hint_free";
}[] = [
  { id: "ECONOMY", labelKey: "onboarding.mode.economy", hintKey: "onboarding.mode.hint_economy" },
  { id: "NORMAL",  labelKey: "onboarding.mode.normal",  hintKey: "onboarding.mode.hint_normal"  },
  { id: "FREE",    labelKey: "onboarding.mode.free",    hintKey: "onboarding.mode.hint_free"    },
];

export function OnboardingForm() {
  const t = useT();

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("UNSPECIFIED");
  const [currency, setCurrency] = useState("RUB");
  const [mode, setMode] = useState<BudgetMode>("NORMAL");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Segmented control refs for the gender selector
  const genderSegRef = useRef<HTMLDivElement>(null);
  const genderBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Segmented control refs for the mode selector
  const modeSegRef = useRef<HTMLDivElement>(null);
  const modeBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Slide marker for gender seg
  useLayoutEffect(() => {
    const seg = genderSegRef.current;
    const btn = genderBtnRefs.current[gender];
    if (!seg || !btn) return;
    const segR = seg.getBoundingClientRect();
    const btnR = btn.getBoundingClientRect();
    seg.style.setProperty("--seg-w", `${btnR.width}px`);
    seg.style.setProperty("--seg-x", `${btnR.left - segR.left - 2}px`);
    seg.style.setProperty("--seg-color", "var(--info)");
  }, [gender]);

  // Slide marker for mode seg
  useLayoutEffect(() => {
    const seg = modeSegRef.current;
    const btn = modeBtnRefs.current[mode];
    if (!seg || !btn) return;
    const segR = seg.getBoundingClientRect();
    const btnR = btn.getBoundingClientRect();
    seg.style.setProperty("--seg-w", `${btnR.width}px`);
    seg.style.setProperty("--seg-x", `${btnR.left - segR.left - 2}px`);
    seg.style.setProperty("--seg-color", "var(--accent)");
  }, [mode]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("gender", gender);
    fd.set("primaryCurrencyCode", currency);
    fd.set("activeMode", mode);

    startTransition(async () => {
      const result = await completeOnboardingAction(fd);
      if (result?.error) {
        setError(t("onboarding.error_save"));
      }
    });
  }

  return (
    <form className="onboarding-form" onSubmit={handleSubmit}>
      {/* ── Section 1: Name ── */}
      <div className="ob-field">
        <label className="ob-label mono" htmlFor="ob-name">
          {t("onboarding.name.label")}
        </label>
        <input
          id="ob-name"
          type="text"
          className="settings-input"
          placeholder={t("onboarding.name.placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoFocus
          autoComplete="name"
          required
          style={{ width: "100%", maxWidth: 320 }}
        />
      </div>

      {/* ── Section 2: Gender ── */}
      <div className="ob-field">
        <span className="ob-label mono">{t("onboarding.gender.label")}</span>
        <div className="seg" ref={genderSegRef}>
          {GENDER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              ref={(el) => { genderBtnRefs.current[opt.id] = el; }}
              className={gender === opt.id ? "on" : undefined}
              aria-pressed={gender === opt.id}
              onClick={() => setGender(opt.id)}
              disabled={isPending}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 3: Currency ── */}
      <div className="ob-field">
        <label className="ob-label mono" htmlFor="ob-currency">
          {t("onboarding.currency.label")}
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <select
            id="ob-currency"
            className="settings-select mono"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isPending}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name} ({c.symbol})
              </option>
            ))}
          </select>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
            {t("onboarding.currency.hint")}
          </span>
        </div>
      </div>

      {/* ── Section 4: Budget mode ── */}
      <div className="ob-field">
        <span className="ob-label mono">{t("onboarding.mode.label")}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="seg" ref={modeSegRef}>
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                ref={(el) => { modeBtnRefs.current[opt.id] = el; }}
                className={mode === opt.id ? "on" : undefined}
                aria-pressed={mode === opt.id}
                onClick={() => setMode(opt.id)}
                disabled={isPending}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
          {/* Show hint for selected mode */}
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
            {t(MODE_OPTIONS.find((o) => o.id === mode)!.hintKey)}
          </span>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mono" style={{ fontSize: 11, color: "var(--neg)", marginTop: 4 }}>
          {error}
        </div>
      )}

      {/* ── Submit ── */}
      <div style={{ paddingTop: 8 }}>
        <button
          type="submit"
          disabled={isPending || name.trim().length === 0}
          className="btn primary"
          style={{ width: "100%", maxWidth: 320, justifyContent: "center", padding: "10px 20px", fontSize: 12 }}
        >
          {isPending ? "..." : t("onboarding.submit")}
        </button>
      </div>
    </form>
  );
}
