"use client";

import { useEffect, useRef, useState } from "react";

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
  return Math.round(value).toLocaleString("en-US").replace(/,/g, " ");
}

export function CountUp({ to, format: fmt = "spaced", durationMs = 800, fallback }: Props) {
  const [display, setDisplay] = useState<string>(fallback ?? format(to, fmt));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(format(to, fmt));
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / durationMs);
      setDisplay(format(to * easeOutCubic(k), fmt));
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [to, fmt, durationMs]);

  return <span data-countup>{display}</span>;
}
