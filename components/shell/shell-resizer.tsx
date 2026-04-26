"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

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
  const t = useT();

  // State only used for initial render value and persistence.
  // During drag, CSS vars are written directly to the DOM element.
  const [railW, setRailW] = useState(DEFAULT_RAIL);
  const [sumW,  setSumW]  = useState(DEFAULT_SUM);

  const shellRef = useRef<HTMLDivElement>(null);

  // Track the current "live" values during drag so pointerUp can persist them.
  const liveRailW = useRef(DEFAULT_RAIL);
  const liveSumW  = useRef(DEFAULT_SUM);

  // read from localStorage once on mount
  useLayoutEffect(() => {
    try {
      const r = localStorage.getItem(LS_RAIL);
      const s = localStorage.getItem(LS_SUMMARY);
      if (r) {
        const val = clamp(parseInt(r, 10), RAIL_MIN, RAIL_MAX);
        setRailW(val);
        liveRailW.current = val;
      }
      if (s) {
        const val = clamp(parseInt(s, 10), SUM_MIN, SUM_MAX);
        setSumW(val);
        liveSumW.current = val;
      }
    } catch {
      // ignore (private mode, etc.)
    }
  }, []);

  const dragRef = useRef<{ kind: "rail" | "sum"; startX: number; startW: number } | null>(null);
  // rAF pending value for the current drag direction
  const rafPending = useRef<{ kind: "rail" | "sum"; value: number } | null>(null);
  const rafId = useRef<number | null>(null);

  // rAF callback — writes CSS var to DOM directly (no setState, no re-render)
  const rafFlush = useCallback(() => {
    rafId.current = null;
    const p = rafPending.current;
    if (!p || !shellRef.current) return;
    rafPending.current = null;
    if (p.kind === "rail") {
      shellRef.current.style.setProperty("--rail-w", p.value + "px");
      liveRailW.current = p.value;
    } else {
      shellRef.current.style.setProperty("--summary-w", p.value + "px");
      liveSumW.current = p.value;
    }
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    let value: number;
    if (d.kind === "rail") {
      value = clamp(d.startW + delta, RAIL_MIN, RAIL_MAX);
    } else {
      // summary handle on the left edge of summary: dragging left grows summary
      value = clamp(d.startW - delta, SUM_MIN, SUM_MAX);
    }
    rafPending.current = { kind: d.kind, value };
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(rafFlush);
    }
  }, [rafFlush]);

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    // Flush any pending rAF immediately
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    rafFlush();

    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);

    // Persist final value and sync state so React is aware
    try {
      if (d.kind === "rail") {
        localStorage.setItem(LS_RAIL, String(liveRailW.current));
        setRailW(liveRailW.current);
      } else {
        localStorage.setItem(LS_SUMMARY, String(liveSumW.current));
        setSumW(liveSumW.current);
      }
    } catch { /* ignore */ }
  }, [onPointerMove, rafFlush]);

  const startDrag = useCallback(
    (kind: "rail" | "sum") => (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = {
        kind,
        startX: e.clientX,
        startW: kind === "rail" ? liveRailW.current : liveSumW.current,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  // double-click resets to default
  const resetRail = useCallback(() => {
    liveRailW.current = DEFAULT_RAIL;
    setRailW(DEFAULT_RAIL);
    shellRef.current?.style.setProperty("--rail-w", DEFAULT_RAIL + "px");
    try { localStorage.setItem(LS_RAIL, String(DEFAULT_RAIL)); } catch {}
  }, []);
  const resetSum = useCallback(() => {
    liveSumW.current = DEFAULT_SUM;
    setSumW(DEFAULT_SUM);
    shellRef.current?.style.setProperty("--summary-w", DEFAULT_SUM + "px");
    try { localStorage.setItem(LS_SUMMARY, String(DEFAULT_SUM)); } catch {}
  }, []);

  const resizeTitle = t("shell.resize.title");

  return (
    <div
      ref={shellRef}
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
        aria-label={t("shell.resize.aria_rail")}
        aria-orientation="vertical"
        title={resizeTitle}
        onPointerDown={startDrag("rail")}
        onDoubleClick={resetRail}
      />
      <div
        className="resize-handle summary-handle"
        role="separator"
        aria-label={t("shell.resize.aria_summary")}
        aria-orientation="vertical"
        title={resizeTitle}
        onPointerDown={startDrag("sum")}
        onDoubleClick={resetSum}
      />
    </div>
  );
}
