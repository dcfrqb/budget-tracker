"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

export type WeatherKind = "sun" | "cloud" | "rain" | "storm";

export interface WeatherProps {
  kind: WeatherKind;
  savingsRatePct: number | null;
  reason: string;
}

type KindConfig = {
  colorVar: string;
  score: number;      // 1..10 — higher = worse (alert level)
  filledOutOf10: number; // resilience filled cells (higher = better)
  icon: ReactNode;
};

const KIND_CONFIG: Record<WeatherKind, KindConfig> = {
  sun: {
    colorVar: "var(--accent)",
    score: 2,
    filledOutOf10: 10,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="50" r="16" fill="rgba(88,211,163,.12)" stroke="currentColor" />
        <line x1="50" y1="20" x2="50" y2="26" />
        <line x1="50" y1="74" x2="50" y2="80" />
        <line x1="20" y1="50" x2="26" y2="50" />
        <line x1="74" y1="50" x2="80" y2="50" />
        <line x1="28" y1="28" x2="33" y2="33" />
        <line x1="67" y1="67" x2="72" y2="72" />
        <line x1="72" y1="28" x2="67" y2="33" />
        <line x1="33" y1="67" x2="28" y2="72" />
      </svg>
    ),
  },
  cloud: {
    colorVar: "var(--pos)",
    score: 4,
    filledOutOf10: 9,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 68 Q18 68 18 56 Q18 46 28 44 Q30 32 44 32 Q58 32 62 44 Q76 44 76 56 Q76 68 64 68 Z" fill="rgba(63,185,80,.10)" />
      </svg>
    ),
  },
  rain: {
    colorVar: "var(--warn)",
    score: 7,
    filledOutOf10: 5,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 56 Q18 56 18 44 Q18 34 28 32 Q30 20 44 20 Q58 20 62 32 Q76 32 76 44 Q76 56 64 56 Z" fill="rgba(210,153,34,.10)" />
        <line x1="34" y1="66" x2="30" y2="80" />
        <line x1="50" y1="66" x2="46" y2="80" />
        <line x1="66" y1="66" x2="62" y2="80" />
      </svg>
    ),
  },
  storm: {
    colorVar: "var(--neg)",
    score: 9,
    filledOutOf10: 2,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 56 Q18 56 18 44 Q18 34 28 32 Q30 20 44 20 Q58 20 62 32 Q76 32 76 44 Q76 56 64 56 Z" fill="rgba(248,81,73,.10)" />
        <path d="M50 60 L42 76 L54 74 L46 88" fill="none" />
      </svg>
    ),
  },
};

const REASON_KEYS: Record<string, string> = {
  outflow_gt_inflow_3_months: "analytics.weather.reason.outflow_gt_inflow_3_months",
  savings_rate_lt_5pct: "analytics.weather.reason.savings_rate_lt_5pct",
  savings_rate_5_to_20pct: "analytics.weather.reason.savings_rate_5_to_20pct",
  savings_rate_gt_20pct: "analytics.weather.reason.savings_rate_gt_20pct",
};

export function Weather({ kind, savingsRatePct, reason }: WeatherProps) {
  const t = useT();
  const cfg = KIND_CONFIG[kind];
  const kindLabel = t(`analytics.weather.kind.${kind}` as Parameters<typeof t>[0]);

  const srText =
    savingsRatePct === null
      ? t("analytics.weather.savings_rate.no_data")
      : t("analytics.weather.savings_rate.line", {
          vars: { value: `${savingsRatePct >= 0 ? "+" : ""}${savingsRatePct.toFixed(1)}` },
        });

  const reasonKey = REASON_KEYS[reason];
  const reasonHint = reasonKey ? t(reasonKey as Parameters<typeof t>[0]) : "";

  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("analytics.weather.title")}</b>{" "}
          <span className="dim">&middot; {t("analytics.weather.subtitle")}</span>
        </div>
        <div className="meta mono">{t("analytics.weather.meta")}</div>
      </div>
      <div className="weather">
        <div className="wx-hero">
          <div className="wx-label">{t("analytics.weather.status_label")}</div>
          <div className="wx-icon" aria-hidden style={{ color: cfg.colorVar }}>
            {cfg.icon}
          </div>
          <div className="wx-status" style={{ color: cfg.colorVar }}>{kindLabel}</div>
          <div className="wx-sub mono">{srText}</div>
        </div>

        <div className="wx-cells">
          <div className="k">{t("analytics.weather.scale_label")}</div>
          <div className="wx-gauge" aria-label="gauge">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className={i < cfg.filledOutOf10 ? "on" : ""}
                style={i < cfg.filledOutOf10 ? { background: cfg.colorVar } : undefined}
              />
            ))}
          </div>
          <div className="wx-explain">
            {t("analytics.weather.formula")}
            {reasonHint ? (
              <>{" "}{t("analytics.weather.reason_prefix", { vars: { hint: reasonHint } })}</>
            ) : null}
            {" "}
            <b style={{ color: cfg.colorVar }}>
              {t("analytics.weather.reserve", { vars: { n: String(cfg.filledOutOf10) } })}
            </b>
            {". "}
            <b style={{ color: cfg.colorVar }}>
              {t("analytics.weather.alert_level", { vars: { score: String(cfg.score) } })}
            </b>
            {". "}
            {t("analytics.weather.matches", { vars: { label: kindLabel } })}
          </div>
        </div>

        <div className="wx-cells">
          <div className="k">{t("analytics.weather.classification_label")}</div>
          <div className="mono" style={{ fontSize: 11, lineHeight: 1.9, color: "var(--muted)" }}>
            <div>
              <b style={{ color: "var(--accent)" }}>
                {t("analytics.weather.kind.sun")}
              </b>
              {" · "}
              {t("analytics.weather.classification.sun_threshold")}
              {" · "}
              {t("analytics.weather.classification.sun")}
            </div>
            <div>
              <b style={{ color: "var(--pos)" }}>
                {t("analytics.weather.kind.cloud")}
              </b>
              {" · "}
              {t("analytics.weather.classification.cloud_threshold")}
              {" · "}
              {t("analytics.weather.classification.cloud")}
            </div>
            <div>
              <b style={{ color: "var(--warn)" }}>
                {t("analytics.weather.kind.rain")}
              </b>
              {" · "}
              {t("analytics.weather.classification.rain_threshold")}
              {" · "}
              {t("analytics.weather.classification.rain")}
            </div>
            <div>
              <b style={{ color: "var(--neg)" }}>
                {t("analytics.weather.kind.storm")}
              </b>
              {" · "}
              {t("analytics.weather.classification.storm_threshold")}
              {" · "}
              {t("analytics.weather.classification.storm")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
