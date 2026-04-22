"use client";

import { useEffect } from "react";

type Action = { id: "inc" | "exp" | "txn"; label: string; key: string; svg: React.ReactNode };

const ACTIONS: Action[] = [
  {
    id: "inc",
    label: "+Доход",
    key: "I",
    svg: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7.5 10V2m0 8-3-3m3 3 3-3" />
        <path d="M2 13h11" />
      </svg>
    ),
  },
  {
    id: "exp",
    label: "+Расход",
    key: "E",
    svg: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7.5 5v8m0-8 3 3m-3-3-3 3" />
        <path d="M2 2h11" />
      </svg>
    ),
  },
  {
    id: "txn",
    label: "+Транзакция",
    key: "T",
    svg: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 3 2 6l3 3" />
        <path d="M2 6h11" />
        <path d="M10 12l3-3-3-3" />
        <path d="M13 9H2" />
      </svg>
    ),
  },
];

export function QuickActions() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toUpperCase();
      const match = ACTIONS.find((a) => a.key === k);
      if (!match) return;
      const btn = document.querySelector<HTMLButtonElement>(`button[data-qa="${match.id}"]`);
      btn?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>быстрые действия</b>
        </div>
        <div className="meta mono">хоткеи активны</div>
      </div>
      <div className="section-body flush">
        <div className="qa-row">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              className="qa-btn"
              data-qa={a.id}
              onClick={() => console.info(`qa:${a.id}`)}
            >
              <span className="qa-inner">
                {a.svg}
                <span>{a.label}</span>
              </span>
              <span className="k">{a.key}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
