"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const LS_RAIL    = "bdg:rail-w";
const LS_SUMMARY = "bdg:summary-w";

const RAIL_MIN = 60;
const RAIL_MAX = 240;
const SUM_MIN  = 240;
const SUM_MAX  = 480;

const DEFAULT_RAIL = 60;
const DEFAULT_SUM  = 300;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function ShellResizer({ children }: { children: React.ReactNode }) {
  const [railW, setRailW] = useState(DEFAULT_RAIL);
  const [sumW,  setSumW]  = useState(DEFAULT_SUM);
  const [hydrated, setHydrated] = useState(false);

  // read from localStorage once on mount
  useLayoutEffect(() => {
    try {
      const r = localStorage.getItem(LS_RAIL);
      const s = localStorage.getItem(LS_SUMMARY);
      if (r) setRailW(clamp(parseInt(r, 10), RAIL_MIN, RAIL_MAX));
      if (s) setSumW(clamp(parseInt(s, 10), SUM_MIN, SUM_MAX));
    } catch {
      // ignore (private mode, etc.)
    }
    setHydrated(true);
  }, []);

  const dragRef = useRef<{ kind: "rail" | "sum"; startX: number; startW: number } | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    if (d.kind === "rail") {
      setRailW(clamp(d.startW + delta, RAIL_MIN, RAIL_MAX));
    } else {
      // summary handle on the left edge of summary: dragging left grows summary
      setSumW(clamp(d.startW - delta, SUM_MIN, SUM_MAX));
    }
  }, []);

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    try {
      if (d.kind === "rail") localStorage.setItem(LS_RAIL, String(railW));
      else                   localStorage.setItem(LS_SUMMARY, String(sumW));
    } catch { /* ignore */ }
  }, [onPointerMove, railW, sumW]);

  const startDrag = useCallback(
    (kind: "rail" | "sum") => (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = {
        kind,
        startX: e.clientX,
        startW: kind === "rail" ? railW : sumW,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [railW, sumW, onPointerMove, onPointerUp],
  );

  // double-click resets to default
  const resetRail = useCallback(() => {
    setRailW(DEFAULT_RAIL);
    try { localStorage.setItem(LS_RAIL, String(DEFAULT_RAIL)); } catch {}
  }, []);
  const resetSum = useCallback(() => {
    setSumW(DEFAULT_SUM);
    try { localStorage.setItem(LS_SUMMARY, String(DEFAULT_SUM)); } catch {}
  }, []);

  // persist on change (debounced lightly via rAF is overkill — we already save on pointer-up)
  useEffect(() => {
    if (!hydrated) return;
    // no-op: persistence happens on pointer-up and reset handlers
  }, [railW, sumW, hydrated]);

  return (
    <div
      className="shell"
      style={{
        ["--rail-w"    as string]: `${railW}px`,
        ["--summary-w" as string]: `${sumW}px`,
      }}
      suppressHydrationWarning
    >
      {children}
      <div
        className="resize-handle rail-handle"
        role="separator"
        aria-label="Ширина навигации"
        aria-orientation="vertical"
        title="Тащи чтобы растянуть · двойной клик — сброс"
        onPointerDown={startDrag("rail")}
        onDoubleClick={resetRail}
      />
      <div
        className="resize-handle summary-handle"
        role="separator"
        aria-label="Ширина сводки"
        aria-orientation="vertical"
        title="Тащи чтобы растянуть · двойной клик — сброс"
        onPointerDown={startDrag("sum")}
        onDoubleClick={resetSum}
      />
    </div>
  );
}
