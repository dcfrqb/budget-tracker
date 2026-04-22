"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { MONTH_DAY, MONTH_DAYS, MONTH_LABEL } from "@/lib/mock";

type TxnType = "all" | "inc" | "exp" | "xfr" | "loan";
type Period = "7д" | "30д" | "90д" | "1г";

const TYPES = [
  { id: "all"  as const, label: "Все" },
  { id: "inc"  as const, label: "Доходы" },
  { id: "exp"  as const, label: "Расходы" },
  { id: "xfr"  as const, label: "Переводы" },
  { id: "loan" as const, label: "Займы" },
];

const PERIODS = [
  { id: "7д"  as const, label: "7д" },
  { id: "30д" as const, label: "30д" },
  { id: "90д" as const, label: "90д" },
  { id: "1г"  as const, label: "1г" },
];

export function TxnStatusStrip() {
  const [type, setType] = useState<TxnType>("all");
  const [period, setPeriod] = useState<Period>("30д");

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">ТИП</span>
      <Segmented options={TYPES} value={type} onChange={setType} />

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
