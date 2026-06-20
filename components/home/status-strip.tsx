"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { Segmented } from "@/components/segmented";

const now = new Date();
const MONTH_DAY = now.getDate();
const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

type Mode = "econom" | "normal" | "free";

const MODE_IDS: Mode[] = ["econom", "normal", "free"];

const MODE_COLOR: Record<Mode, string> = {
  econom: "var(--accent)",
  normal: "var(--pos)",
  free:   "var(--info)",
};

export function StatusStrip() {
  const t = useT();
  const [mode, setMode] = useState<Mode>("normal");

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

  const monthLabel = `${t(MONTH_KEYS[now.getMonth()])} ${now.getFullYear()}`;

  const MODES = MODE_IDS.map((id) => ({
    id,
    label: t(`home.status_strip.modes.${id}` as Parameters<typeof t>[0]),
  }));

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">{t("home.status_strip.mode_label")}</span>
      <Segmented options={MODES} value={mode} onChange={setMode} markerColor={MODE_COLOR[mode]} />

      <div className="clock-right">
        <span>
          {monthLabel} · <b title={t("home.status_strip.day_hint")}>{MONTH_DAY}/{MONTH_DAYS}</b>
        </span>
      </div>
    </div>
  );
}
