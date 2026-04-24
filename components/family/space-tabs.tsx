"use client";

import { useState } from "react";

export type SpaceTab = {
  id: string;
  tag: string;
  n: string;
  s: string;
  amount: string;
  amountLabel: string;
};

export function SpaceTabs({ spaces }: { spaces: SpaceTab[] }) {
  const [active, setActive] = useState(spaces[0]?.id ?? "");
  return (
    <div className="section fade-in" style={{ animationDelay: "160ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>пространства</b> <span className="dim">· личное / общее</span>
        </div>
        <div className="meta mono">переключай при добавлении транзакции</div>
      </div>
      <div className="space-tabs">
        {spaces.map((s) => (
          <div
            key={s.id}
            className={`space-tab${active === s.id ? " on" : ""}`}
            tabIndex={0}
            onClick={() => setActive(s.id)}
          >
            <span className="dot" />
            <div>
              <div className="tag mono">{s.tag}</div>
              <div className="n">{s.n}</div>
              <div className="s">{s.s}</div>
            </div>
            <div className="amt">
              <div className="v">{s.amount}</div>
              <div className="l">{s.amountLabel}</div>
            </div>
          </div>
        ))}
        {spaces.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет пространств
          </div>
        )}
      </div>
    </div>
  );
}
