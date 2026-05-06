import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export async function IntegrationsSection() {
  const t = await getT();
  const isAdmin = process.env.ADMIN_INTEGRATIONS === "true";

  return (
    <div className="settings-section">
      <div className="settings-section-title mono">
        {t("settings.integrations.section_title")}
      </div>
      {isAdmin ? (
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/wallet/integrations" className="btn primary">
            {t("settings.integrations.manage")}
          </Link>
        </div>
      ) : (
        <div className="sig info">
          <div className="k">{t("settings.integrations.gated_title")}</div>
          <div className="m">{t("settings.integrations.gated_body")}</div>
        </div>
      )}
    </div>
  );
}
