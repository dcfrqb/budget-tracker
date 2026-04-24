"use client";

import { useLayoutEffect, useRef } from "react";
import { useT, useLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { setLocaleAction } from "@/app/(shell)/settings/actions";

const LOCALE_OPTIONS: { id: Locale; label: string }[] = [
  { id: "ru", label: "RU" },
  { id: "en", label: "EN" },
];

export function LocaleSwitcher() {
  const t = useT();
  const locale = useLocale();

  const segRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useLayoutEffect(() => {
    const seg = segRef.current;
    const btn = btnRefs.current[locale];
    if (!seg || !btn) return;
    const segR = seg.getBoundingClientRect();
    const btnR = btn.getBoundingClientRect();
    seg.style.setProperty("--seg-w", `${btnR.width}px`);
    seg.style.setProperty("--seg-x", `${btnR.left - segR.left - 2}px`);
  }, [locale]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span className="mono" style={{ color: "var(--muted)", fontSize: 11, minWidth: 80 }}>
        {t("settings.locale.label")}
      </span>
      <div className="seg" ref={segRef}>
        {LOCALE_OPTIONS.map((opt) => (
          <form key={opt.id} action={setLocaleAction} style={{ display: "contents" }}>
            <input type="hidden" name="locale" value={opt.id} />
            <button
              type="submit"
              ref={(el) => { btnRefs.current[opt.id] = el; }}
              className={locale === opt.id ? "on" : undefined}
              aria-pressed={locale === opt.id}
            >
              {opt.label}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
