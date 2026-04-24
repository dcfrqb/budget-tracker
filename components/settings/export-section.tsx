"use client";

import { useT } from "@/lib/i18n";

export function ExportSection() {
  const t = useT();

  function handleExport() {
    window.location.href = "/api/export";
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title mono">
        {t("settings.export.section_title")}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <span className="settings-section-summary mono">
          {t("settings.export.description")}
        </span>
        <button type="button" className="btn primary" onClick={handleExport} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          {t("settings.export.button")}
        </button>
      </div>
    </div>
  );
}
