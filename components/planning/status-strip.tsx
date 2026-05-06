"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { useT } from "@/lib/i18n";

const now = new Date();
const MONTH_DAY = now.getDate();
const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

const MONTH_KEYS = [
  "common.month.short.1",
  "common.month.short.2",
  "common.month.short.3",
  "common.month.short.4",
  "common.month.short.5",
  "common.month.short.6",
  "common.month.short.7",
  "common.month.short.8",
  "common.month.short.9",
  "common.month.short.10",
  "common.month.short.11",
  "common.month.short.12",
] as const;

type View = "all" | "calendar" | "funds" | "buys" | "trips";
type Horizon = "30d" | "90d" | "1y" | "all";

export function PlanningStatusStrip() {
  const t = useT();
  const [view, setView] = useState<View>("all");
  const [horizon, setHorizon] = useState<Horizon>("90d");

  const monthLabel = `${t(MONTH_KEYS[now.getMonth()])} ${now.getFullYear()}`;

  const VIEWS: { id: View; label: string }[] = [
    { id: "all",      label: t("planning.status_strip.view_all") },
    { id: "calendar", label: t("planning.status_strip.view_calendar") },
    { id: "funds",    label: t("planning.status_strip.view_funds") },
    { id: "buys",     label: t("planning.status_strip.view_buys") },
    { id: "trips",    label: t("planning.status_strip.view_trips") },
  ];

  const HORIZONS: { id: Horizon; label: string }[] = [
    { id: "30d", label: t("planning.status_strip.horizon_30d") },
    { id: "90d", label: t("planning.status_strip.horizon_90d") },
    { id: "1y",  label: t("planning.status_strip.horizon_1y") },
    { id: "all", label: t("planning.status_strip.horizon_all") },
  ];

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">{t("planning.status_strip.view_label")}</span>
      <Segmented options={VIEWS} value={view} onChange={setView} />
      <span className="lbl">{t("planning.status_strip.horizon_label")}</span>
      <Segmented options={HORIZONS} value={horizon} onChange={setHorizon} />
      <div className="clock-right">
        <span>
          {monthLabel} · <b title={t("planning.status_strip.day_hint")}>{MONTH_DAY}/{MONTH_DAYS}</b>
        </span>
      </div>
    </div>
  );
}
