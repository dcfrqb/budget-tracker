"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { useT } from "@/lib/i18n";

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

type Space = "shared" | "personal" | "all";
type Period = "month" | "90d" | "ytd" | "all";

const now = new Date();
const MONTH_DAY = now.getDate();
const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

export function FamilyStatusStrip({ hasGroup }: { hasGroup: boolean }) {
  const t = useT();
  const [space, setSpace] = useState<Space>("shared");
  const [period, setPeriod] = useState<Period>("month");

  const monthLabel = `${t(MONTH_KEYS[now.getMonth()])} ${now.getFullYear()}`;

  const SPACES: { id: Space; label: string }[] = [
    { id: "shared",   label: t("family.status_strip.space_shared") },
    { id: "personal", label: t("family.status_strip.space_personal") },
    { id: "all",      label: t("family.status_strip.space_all") },
  ];

  const PERIODS: { id: Period; label: string }[] = [
    { id: "month", label: t("family.status_strip.period_month") },
    { id: "90d",   label: t("family.status_strip.period_90d") },
    { id: "ytd",   label: t("family.status_strip.period_ytd") },
    { id: "all",   label: t("family.status_strip.period_all") },
  ];

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      {hasGroup && (
        <>
          <span className="lbl">{t("family.status_strip.space_label")}</span>
          <Segmented options={SPACES} value={space} onChange={setSpace} />
        </>
      )}
      <span className="lbl">{t("family.status_strip.period_label")}</span>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <div className="clock-right">
        <span>{monthLabel} · <b title={t("family.status_strip.day_hint")}>{MONTH_DAY}/{MONTH_DAYS}</b></span>
      </div>
    </div>
  );
}
