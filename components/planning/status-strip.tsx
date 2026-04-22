"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { MONTH_DAY, MONTH_DAYS, MONTH_LABEL } from "@/lib/mock";

const VIEWS = [
  { id: "all"      as const, label: "Всё" },
  { id: "calendar" as const, label: "Календарь" },
  { id: "funds"    as const, label: "Накопления" },
  { id: "buys"     as const, label: "Покупки" },
  { id: "trips"    as const, label: "Трипы" },
];

const HORIZONS = [
  { id: "30д" as const, label: "30д" },
  { id: "90д" as const, label: "90д" },
  { id: "1г"  as const, label: "1г" },
  { id: "всё" as const, label: "всё" },
];

type View = (typeof VIEWS)[number]["id"];
type Horizon = (typeof HORIZONS)[number]["id"];

export function PlanningStatusStrip() {
  const [view, setView] = useState<View>("all");
  const [horizon, setHorizon] = useState<Horizon>("90д");
  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">ВИД</span>
      <Segmented options={VIEWS} value={view} onChange={setView} />
      <span className="lbl">ГОРИЗОНТ</span>
      <Segmented options={HORIZONS} value={horizon} onChange={setHorizon} />
      <div className="clock-right">
        <span>{MONTH_LABEL} · <b>д{MONTH_DAY}/{MONTH_DAYS}</b></span>
        <span>синхр <b>2с назад</b></span>
      </div>
    </div>
  );
}
