"use client";

import { useT } from "@/lib/i18n";
import { LocaleSwitcher } from "./locale-switcher";

export function SettingsContent() {
  const t = useT();

  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("settings.title")}</b>{" "}
          <span className="dim">{"\u00b7"} {t("settings.subtitle")}</span>
        </div>
        <div className="meta mono">{t("settings.soon")}</div>
      </div>
      <div className="section-body">
        <div
          className="mono"
          style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.7, marginBottom: 20 }}
        >
          {t("settings.description")}
        </div>

        <div
          style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}
        >
          <div
            className="mono"
            style={{ color: "var(--dim)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}
          >
            {t("settings.locale.sectionTitle")}
          </div>
          <LocaleSwitcher />
        </div>
      </div>
    </div>
  );
}
