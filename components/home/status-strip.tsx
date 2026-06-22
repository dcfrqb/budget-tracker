"use client";

import { useOptimistic, useTransition } from "react";
import { useT } from "@/lib/i18n";
import { Segmented } from "@/components/segmented";
import { updateBudgetSettingsAction } from "@/app/(shell)/settings/actions";
import type { BudgetMode } from "@prisma/client";

const now = new Date();
const MONTH_DAY = now.getDate();
const MONTH_DAYS = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

type CosmeticId = "econom" | "normal" | "free";

const COSMETIC_IDS: CosmeticId[] = ["econom", "normal", "free"];

const MODE_COLOR: Record<CosmeticId, string> = {
  econom: "var(--accent)",
  normal: "var(--pos)",
  free:   "var(--info)",
};

const TO_BUDGET_MODE: Record<CosmeticId, BudgetMode> = {
  econom: "ECONOMY",
  normal: "NORMAL",
  free:   "FREE",
};

const FROM_BUDGET_MODE: Record<BudgetMode, CosmeticId> = {
  ECONOMY: "econom",
  NORMAL:  "normal",
  FREE:    "free",
};

type Props = {
  activeMode: BudgetMode;
};

export function StatusStrip({ activeMode }: Props) {
  const t = useT();
  const [optimisticMode, setOptimisticMode] = useOptimistic<BudgetMode, BudgetMode>(
    activeMode,
    (_state, m) => m,
  );
  const [, startTransition] = useTransition();

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

  const MODES = COSMETIC_IDS.map((id) => ({
    id,
    label: t(`home.status_strip.modes.${id}` as Parameters<typeof t>[0]),
  }));

  const cosmeticId = FROM_BUDGET_MODE[optimisticMode];

  function handleChange(id: CosmeticId) {
    const bm = TO_BUDGET_MODE[id];
    startTransition(async () => {
      setOptimisticMode(bm);
      const fd = new FormData();
      fd.set("activeMode", bm);
      await updateBudgetSettingsAction(fd);
    });
  }

  return (
    <div className="status-strip fade-in" style={{ animationDelay: "0ms" }}>
      <span className="lbl">{t("home.status_strip.mode_label")}</span>
      <Segmented
        options={MODES}
        value={cosmeticId}
        onChange={handleChange}
        markerColor={MODE_COLOR[cosmeticId]}
      />

      <div className="clock-right">
        <span>
          {monthLabel} · <b title={t("home.status_strip.day_hint")}>{MONTH_DAY}/{MONTH_DAYS}</b>
        </span>
      </div>
    </div>
  );
}
