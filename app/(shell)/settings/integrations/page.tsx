import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getCurrentUserId } from "@/lib/api/auth";
import { getAdapters } from "@/lib/integrations/registry";
import { toAdapterMeta } from "@/lib/integrations/types";
import { listCredentials } from "@/lib/data/_mutations/integrations";
import { IntegrationsManager } from "@/components/settings/integrations/integrations-manager";
import type { CredentialRow } from "@/components/settings/integrations/integrations-manager";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const [t, userId] = await Promise.all([getT(), getCurrentUserId()]);

  const isAdmin = process.env.ADMIN_INTEGRATIONS === "true";

  if (!isAdmin) {
    return (
      <div className="feed fade-in" style={{ animationDelay: "60ms" }}>
        <div className="section">
          <div className="section-hd">
            <div className="ttl mono">
              <b>{t("settings.integrations.page_title")}</b>
            </div>
            <Link href="/settings" className="btn">
              {t("forms.category.back")}
            </Link>
          </div>
          <div className="section-body">
            <div className="sig warn" style={{ marginTop: 8 }}>
              <div className="k">{t("settings.integrations.admin_required_title")}</div>
              <div className="m">{t("settings.integrations.admin_required_body")}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const adapters = getAdapters().map(toAdapterMeta);
  const rawCredentials = await listCredentials(userId);

  // Serialize dates to strings for client component props
  const credentials: CredentialRow[] = rawCredentials.map((c) => ({
    id: c.id,
    adapterId: c.adapterId,
    displayLabel: c.displayLabel,
    status: c.status,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    lastErrorAt: c.lastErrorAt?.toISOString() ?? null,
    lastErrorMessage: c.lastErrorMessage,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="feed fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section">
        <div className="section-hd">
          <div className="ttl mono">
            <b>{t("settings.integrations.title")}</b>
          </div>
          <Link href="/settings" className="btn">
            {t("forms.category.back")}
          </Link>
        </div>
        <div className="section-body" style={{ paddingTop: 8 }}>
          <IntegrationsManager
            adapters={adapters}
            credentials={credentials}
          />
        </div>
      </div>
    </div>
  );
}
