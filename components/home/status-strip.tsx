"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";

const RU_MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const now = new Date();
const MONTH_LABEL = `${RU_MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}`;
const MONTH_DAY = now.getDate();
const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

type Mode = "econom" | "normal" | "free";
type Period = "7д" | "30д" | "90д" | "1г";

const MODES = [
  { id: "econom" as const, label: "Эконом" },
  { id: "normal" as const, label: "Норма" },
  { id: "free"   as const, label: "Свобода" },
];

const MODE_COLOR: Record<Mode, string> = {
  econom: "var(--accent)",
  normal: "var(--pos)",
  free:   "var(--info)",
};

const PERIODS = [
  { id: "7д"  as const, label: "7д" },
  { id: "30д" as const, label: "30д" },
  { id: "90д" as const, label: "90д" },
  { id: "1г"  as const, label: "1г" },
];

export function StatusStrip() {
  const [mode, setMode] = useState<Mode>("normal");
  const [period, setPeriod] = useState<Period>("30д");

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">РЕЖИМ</span>
      <Segmented options={MODES} value={mode} onChange={setMode} markerColor={MODE_COLOR[mode]} />

      <span className="lbl">ПЕРИОД</span>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      <div className="clock-right">
        <span>
          {MONTH_LABEL} · <b>д{MONTH_DAY}/{MONTH_DAYS}</b>
        </span>
        <span>
          синхр <b>2с</b>
        </span>
      </div>
    </div>
  );
}
