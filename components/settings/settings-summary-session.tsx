"use client";

import { useT } from "@/lib/i18n";

export function SettingsSummarySession() {
  const t = useT();

  return (
    <div className="sum-block">
      <div className="lbl">
        <span>{t("summary.settings.view")}</span>
        <span className="tiny mono">{t("settings.title")}</span>
      </div>
      <div className="status-row">
        <span className="dot live" style={{ background: "var(--pos)" }} />
        <span className="k">{t("summary.settings.mode")}</span>
        <span className="v pos">{t("summary.settings.modeValue")}</span>
      </div>
      <div className="status-row">
        <span className="dot" style={{ background: "var(--muted)" }} />
        <span className="k">{t("summary.settings.view")}</span>
        <span className="v">{t("summary.settings.viewValue")}</span>
      </div>
    </div>
  );
}
