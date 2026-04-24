"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";

const RU_MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const now = new Date();
const MONTH_LABEL = `${RU_MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}`;
const MONTH_DAY = now.getDate();
const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

const VIEWS = [
  { id: "sources"  as const, label: "Источники" },
  { id: "expected" as const, label: "Ожидаемые" },
  { id: "other"    as const, label: "Прочее" },
];

const PERIODS = [
  { id: "30д" as const, label: "30д" },
  { id: "90д" as const, label: "90д" },
  { id: "1г"  as const, label: "1г" },
  { id: "всё" as const, label: "всё" },
];

type View = (typeof VIEWS)[number]["id"];
type Period = (typeof PERIODS)[number]["id"];

export function IncomeStatusStrip() {
  const [view, setView] = useState<View>("sources");
  const [period, setPeriod] = useState<Period>("90д");

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">ВИД</span>
      <Segmented options={VIEWS} value={view} onChange={setView} />
      <span className="lbl">ПЕРИОД</span>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <div className="clock-right">
        <span>{MONTH_LABEL} · <b>д{MONTH_DAY}/{MONTH_DAYS}</b></span>
        <span>синхр <b>2с</b></span>
      </div>
    </div>
  );
}
