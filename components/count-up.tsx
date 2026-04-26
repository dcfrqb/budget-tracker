"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPlainNumber } from "@/lib/format/money";

type Props = {
  to: number;
  /** 'spaced' => 237 880, 'int' => 47 */
  format?: "spaced" | "int";
  durationMs?: number;
  /** Optional non-breaking fallback until client mounts. Defaults to the formatted final value. */
  fallback?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function format(value: number, kind: "spaced" | "int"): string {
  if (kind === "int") return String(Math.round(value));
  return formatPlainNumber(Math.round(value));
}

export function CountUp({ to, format: fmt = "spaced", durationMs = 800, fallback }: Props) {
  const [display, setDisplay] = useState<string>(fallback ?? format(to, fmt));
  const rafRef = useRef<number | null>(null);

  // Store the latest animation params in a ref so the tick callback
  // doesn't need to be recreated when they change.
  const paramsRef = useRef({ to, fmt, durationMs });
  paramsRef.current = { to, fmt, durationMs };

  // Stable tick function — deps are empty, reads latest values from ref.
  const tick = useCallback((start: number) => {
    const step = (now: number) => {
      const { to: toVal, fmt: fmtVal, durationMs: dur } = paramsRef.current;
      const k = Math.min(1, (now - start) / dur);
      setDisplay(format(toVal * easeOutCubic(k), fmtVal));
      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    return step;
  }, []); // stable — no deps

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(format(to, fmt));
      return;
    }
    const start = performance.now();
    const step = tick(start);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  // Re-run animation only when target value or formatting params change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, fmt, durationMs]);

  return <span data-countup>{display}</span>;
}
