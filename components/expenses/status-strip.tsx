"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";

const RU_MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const now = new Date();
const MONTH_LABEL = `${RU_MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}`;
const MONTH_DAY = now.getDate();
const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

const SECTIONS = [
  { id: "all"      as const, label: "Все" },
  { id: "loans"    as const, label: "Кредиты" },
  { id: "subs"     as const, label: "Подписки" },
  { id: "projects" as const, label: "Проекты" },
  { id: "taxes"    as const, label: "Налоги" },
];

const PERIODS = [
  { id: "30д" as const, label: "30д" },
  { id: "90д" as const, label: "90д" },
  { id: "1г"  as const, label: "1г" },
  { id: "всё" as const, label: "всё" },
];

type Sec = (typeof SECTIONS)[number]["id"];
type Period = (typeof PERIODS)[number]["id"];

export function ExpensesStatusStrip() {
  const [section, setSection] = useState<Sec>("all");
  const [period, setPeriod] = useState<Period>("90д");
  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">РАЗДЕЛ</span>
      <Segmented options={SECTIONS} value={section} onChange={setSection} />
      <span className="lbl">ПЕРИОД</span>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <div className="clock-right">
        <span>{MONTH_LABEL} · <b>д{MONTH_DAY}/{MONTH_DAYS}</b></span>
        <span>синхр <b>2с</b></span>
      </div>
    </div>
  );
}
