"use client";

import { useTransition } from "react";
import { useT } from "@/lib/i18n";
import { updateDefaultPeriodAction } from "@/app/(shell)/settings/actions";
import type { CuratedDefaultPeriod } from "@/lib/data/_period";
import type { TKey } from "@/lib/i18n/t";

type Option = {
  value: CuratedDefaultPeriod;
  labelKey: TKey;
};

const OPTIONS: Option[] = [
  { value: "30d",  labelKey: "common.period.30d" },
  { value: "90d",  labelKey: "common.period.90d" },
  { value: "3m",   labelKey: "common.period.3m" },
  { value: "6m",   labelKey: "common.period.6m" },
  { value: "12m",  labelKey: "common.period.12m" },
  { value: "tm",   labelKey: "common.period.this_month" },
  { value: "tq",   labelKey: "common.period.this_quarter" },
  { value: "ty",   labelKey: "common.period.this_year" },
  { value: "all",  labelKey: "settings.default_period.option_all" },
];

type Props = {
  current: CuratedDefaultPeriod;
};

export function DefaultPeriod({ current }: Props) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: CuratedDefaultPeriod) {
    if (value === current) return;
    const formData = new FormData();
    formData.set("defaultPeriod", value);
    startTransition(async () => {
      await updateDefaultPeriodAction(formData);
    });
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title mono">
        {t("settings.default_period.section_title")}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0,
          marginTop: 6,
          border: "1px solid var(--border)",
          borderRadius: 3,
          overflow: "hidden",
          width: "fit-content",
          opacity: isPending ? 0.7 : 1,
          transition: "opacity 150ms",
        }}
      >
        {OPTIONS.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className="btn"
              disabled={isPending}
              onClick={() => handleChange(opt.value)}
              style={{
                borderRadius: 0,
                border: "none",
                borderRight: "1px solid var(--border)",
                background: active ? "var(--panel-2)" : "transparent",
                color: active ? "var(--text)" : "var(--muted)",
                fontWeight: active ? 600 : 400,
                padding: "4px 10px",
                fontSize: "var(--text-xs)",
                minWidth: 40,
              }}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
      <div
        className="mono"
        style={{ marginTop: 6, fontSize: "var(--text-2xs)", color: "var(--dim)" }}
      >
        {t("settings.default_period.hint")}
      </div>
    </div>
  );
}
