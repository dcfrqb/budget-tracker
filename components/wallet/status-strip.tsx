"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { MONTH_DAY, MONTH_DAYS, MONTH_LABEL } from "@/lib/mock";

const GROUPS = [
  { id: "all"    as const, label: "Все" },
  { id: "banks"  as const, label: "Банки" },
  { id: "crypto" as const, label: "Крипто" },
  { id: "cash"   as const, label: "Наличка" },
  { id: "arch"   as const, label: "Архив" },
];

const CCY = [
  { id: "all" as const, label: "Все" },
  { id: "RUB" as const, label: "RUB" },
  { id: "USD" as const, label: "USD" },
  { id: "EUR" as const, label: "EUR" },
];

type Group = (typeof GROUPS)[number]["id"];
type Ccy = (typeof CCY)[number]["id"];

export function WalletStatusStrip() {
  const [group, setGroup] = useState<Group>("all");
  const [ccy, setCcy] = useState<Ccy>("all");
  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">ГРУППА</span>
      <Segmented options={GROUPS} value={group} onChange={setGroup} />
      <span className="lbl">ВАЛЮТА</span>
      <Segmented options={CCY} value={ccy} onChange={setCcy} />
      <div className="clock-right">
        <span>{MONTH_LABEL} · <b>д{MONTH_DAY}/{MONTH_DAYS}</b></span>
        <span>синхр <b>2с назад</b></span>
      </div>
    </div>
  );
}
