"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";

const RU_MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const now = new Date();
const MONTH_LABEL = `${RU_MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}`;
const MONTH_DAY = now.getDate();
const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

const PERIODS = [
  { id: "1м"  as const, label: "1 мес" },
  { id: "3м"  as const, label: "3 мес" },
  { id: "6м"  as const, label: "6 мес" },
  { id: "12м" as const, label: "12 мес" },
  { id: "ytd" as const, label: "YTD" },
];

const CMP = [
  { id: "prev"  as const, label: "пред. периодом" },
  { id: "yoy"   as const, label: "год назад" },
  { id: "none"  as const, label: "нет" },
];

type Period = (typeof PERIODS)[number]["id"];
type Cmp = (typeof CMP)[number]["id"];

export function AnalyticsStatusStrip() {
  const [period, setPeriod] = useState<Period>("3м");
  const [cmp, setCmp] = useState<Cmp>("prev");
  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">ПЕРИОД</span>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <span className="lbl">СРАВНИТЬ С</span>
      <Segmented options={CMP} value={cmp} onChange={setCmp} />
      <div className="clock-right">
        <span>{MONTH_LABEL} · <b>д{MONTH_DAY}/{MONTH_DAYS}</b></span>
        <span>синхр <b>2с назад</b></span>
      </div>
    </div>
  );
}
