"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

export type SpaceTab = {
  id: string;
  tag: string;
  n: string;
  s: string;
  amount: string;
  amountLabel: string;
};

export function SpaceTabs({ spaces }: { spaces: SpaceTab[] }) {
  const t = useT();
  const [active, setActive] = useState(spaces[0]?.id ?? "");
  return (
    <div className="section fade-in" style={{ animationDelay: "160ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("family.spaces.title")}</b> <span className="dim">· {t("family.spaces.subtitle")}</span>
        </div>
        <div className="meta mono">{t("family.spaces.hint")}</div>
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
          <div className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", padding: "12px 20px" }}>
            {t("family.spaces.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
