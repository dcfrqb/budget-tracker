"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";

const RU_MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const now = new Date();
const MONTH_LABEL = `${RU_MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}`;
const MONTH_DAY = now.getDate();
const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

const SPACES = [
  { id: "shared"   as const, label: "Общее" },
  { id: "personal" as const, label: "Моё личное" },
  { id: "all"      as const, label: "Всё вместе" },
];

const PERIODS = [
  { id: "month" as const, label: "этот мес" },
  { id: "90d"   as const, label: "90д" },
  { id: "ytd"   as const, label: "YTD" },
  { id: "all"   as const, label: "всё" },
];

type Space = (typeof SPACES)[number]["id"];
type Period = (typeof PERIODS)[number]["id"];

export function FamilyStatusStrip() {
  const [space, setSpace] = useState<Space>("shared");
  const [period, setPeriod] = useState<Period>("month");
  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">ПРОСТРАНСТВО</span>
      <Segmented options={SPACES} value={space} onChange={setSpace} />
      <span className="lbl">ПЕРИОД</span>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <div className="clock-right">
        <span>{MONTH_LABEL} · <b>д{MONTH_DAY}/{MONTH_DAYS}</b></span>
        <span>синхр <b>2с назад</b></span>
      </div>
    </div>
  );
}
