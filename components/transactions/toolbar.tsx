"use client";

import { useEffect, useRef, useState } from "react";

type ChipState = { id: "inc" | "exp" | "xfr"; label: string; active: boolean };

const DEFAULT_CHIPS: ChipState[] = [
  { id: "inc", label: "Доходы",    active: true },
  { id: "exp", label: "Расходы",   active: true },
  { id: "xfr", label: "Переводы",  active: true },
];

export function TxnToolbar() {
  const [chips, setChips] = useState<ChipState[]>(DEFAULT_CHIPS);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggle(id: ChipState["id"]) {
    setChips((prev) => prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
  }

  return (
    <div className="toolbar fade-in" style={{ animationDelay: "60ms" }}>
      <div className="search">
        <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--dim)" }}>
          <circle cx="6.5" cy="6.5" r="4.5" />
          <path d="m13 13-3.2-3.2" />
        </svg>
        <input
          ref={inputRef}
          placeholder="поиск: мерчант, категория, заметка…"
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
      <button type="button" className="chip">+ категория</button>
      <button type="button" className="chip">+ счёт</button>
      <button type="button" className="chip">статус · все</button>
      <button type="button" className="btn primary">
        <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.5 2v8m0 0-3-3m3 3 3-3" />
          <path d="M2 13h11" />
        </svg>
        Импорт CSV
      </button>
    </div>
  );
}
