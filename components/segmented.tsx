"use client";

import { useLayoutEffect, useRef } from "react";

export type SegmentedOption<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** CSS color for the sliding marker. Defaults to var(--accent). */
  markerColor?: string;
};

export function Segmented<T extends string>({ options, value, onChange, markerColor }: Props<T>) {
  const segRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useLayoutEffect(() => {
    const seg = segRef.current;
    const btn = btnRefs.current[value];
    if (!seg || !btn) return;
    const segR = seg.getBoundingClientRect();
    const btnR = btn.getBoundingClientRect();
    seg.style.setProperty("--seg-w", `${btnR.width}px`);
    seg.style.setProperty("--seg-x", `${btnR.left - segR.left - 2}px`);
  }, [value, options]);

  const style: React.CSSProperties = markerColor
    ? ({ ["--seg-color" as string]: markerColor } as React.CSSProperties)
    : {};

  return (
    <div className="seg" ref={segRef} style={style}>
      {options.map((opt) => (
        <button
          key={opt.id}
          ref={(el) => { btnRefs.current[opt.id] = el; }}
          className={value === opt.id ? "on" : undefined}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
