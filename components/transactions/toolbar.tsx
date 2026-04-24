"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { QuickInput, type CategoryOption } from "@/components/transactions/quick-input";

export interface TxnToolbarProps {
  defaultAccountId?: string;
  defaultCurrency?: string;
  categories?: CategoryOption[];
  accountName?: string;
}

type ChipState = { id: "inc" | "exp" | "xfr"; label: string; active: boolean };

export function TxnToolbar({
  defaultAccountId,
  defaultCurrency,
  categories,
  accountName,
}: TxnToolbarProps) {
  const t = useT();
  const [chips, setChips] = useState<ChipState[]>([
    { id: "inc", label: t("forms.common.kind.income"),   active: true },
    { id: "exp", label: t("forms.common.kind.expense"),  active: true },
    { id: "xfr", label: t("forms.common.kind.transfer"), active: true },
  ]);
  const [query, setQuery] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;

      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Q — open quick input and focus
      if (e.key === "Q" || e.key === "q") {
        // Don't intercept here — QuickInput handles own Q hotkey
        // But toggle the panel if it's closed
        if (!showQuick) {
          e.preventDefault();
          setShowQuick(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showQuick]);

  function toggle(id: ChipState["id"]) {
    setChips((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)),
    );
  }

  return (
    <>
      <div className="toolbar fade-in" style={{ animationDelay: "60ms" }}>
        <div className="search">
          <svg
            width="13"
            height="13"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--dim)" }}
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="m13 13-3.2-3.2" />
          </svg>
          <input
            ref={inputRef}
            placeholder={t("import.mapping.description") + "…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="k">/</span>
        </div>
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip ${c.id}${c.active ? " active" : ""}`}
            onClick={() => toggle(c.id)}
          >
            <span className="dot" />
            {c.label}
          </button>
        ))}
        {/* Quick one-liner toggle */}
        <button
          type="button"
          className={`btn${showQuick ? " primary" : ""}`}
          onClick={() => setShowQuick((v) => !v)}
          title={`${t("quick_input.title")} [Q]`}
        >
          <svg
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 4h11M2 8h7M2 12h5" />
            <circle cx="12" cy="11" r="2" />
            <path d="M12 9V7" />
          </svg>
          {t("quick_input.title")}
          <span className="k" style={{ marginLeft: "4px" }}>Q</span>
        </button>
      </div>

      {/* Quick input panel — second row */}
      {showQuick && (
        <QuickInput
          variant="toolbar"
          defaultAccountId={defaultAccountId}
          defaultCurrency={defaultCurrency}
          categories={categories}
          accountName={accountName}
        />
      )}
    </>
  );
}
