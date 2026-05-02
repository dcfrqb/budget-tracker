"use client";

import { useTransition } from "react";
import { useT } from "@/lib/i18n";
import { setAutosyncCadenceAction } from "@/app/(shell)/settings/actions";

type Option = {
  value: "off" | "43200000" | "86400000";
  labelKey: "settings.autosync.option.off" | "settings.autosync.option.12h" | "settings.autosync.option.24h";
};

const OPTIONS: Option[] = [
  { value: "43200000", labelKey: "settings.autosync.option.12h" },
  { value: "86400000", labelKey: "settings.autosync.option.24h" },
  { value: "off",      labelKey: "settings.autosync.option.off" },
];

function msToValue(ms: number | null): "off" | "43200000" | "86400000" {
  if (ms === 43200000) return "43200000";
  if (ms === 86400000) return "86400000";
  return "off";
}

type Props = {
  current: number | null;
};

export function AutosyncCadence({ current }: Props) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  const currentValue = msToValue(current);

  function handleChange(value: "off" | "43200000" | "86400000") {
    const formData = new FormData();
    formData.set("value", value);
    startTransition(async () => {
      await setAutosyncCadenceAction(formData);
    });
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title mono">
        {t("settings.autosync.section_title")}
      </div>
      <div
        style={{
          display: "flex",
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
          const active = currentValue === opt.value;
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
                padding: "4px 12px",
                fontSize: 11,
                minWidth: 44,
              }}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
      <div
        className="mono"
        style={{ marginTop: 6, fontSize: 10, color: "var(--dim)" }}
      >
        {t("settings.autosync.hint")}
      </div>
    </div>
  );
}
