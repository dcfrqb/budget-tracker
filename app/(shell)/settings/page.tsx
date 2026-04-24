import { getCurrentUserId } from "@/lib/api/auth";
import { getT } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { ProfileSection } from "@/components/settings/profile-section";
import { BudgetSection } from "@/components/settings/budget-section";
import { LinkSection } from "@/components/settings/link-section";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { ExportSection } from "@/components/settings/export-section";
import { DangerZone } from "@/components/settings/danger-zone";
import { LocaleSwitcher } from "@/components/settings/locale-switcher";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [userId, t] = await Promise.all([
    getCurrentUserId(),
    getT(),
  ]);

  const [user, budgetSettings, categoryActive, categoryArchived, workSourceCount, accountCount, institutionCount] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, gender: true, email: true },
      }),
      db.budgetSettings.findFirst({ where: { userId } }),
      db.category.count({ where: { userId, archivedAt: null } }),
      db.category.count({ where: { userId, archivedAt: { not: null } } }),
      db.workSource.count({ where: { userId } }),
      db.account.count({ where: { userId, deletedAt: null } }),
      db.institution.count({ where: { userId } }),
    ]);

  const categorySummary = t("settings.categories_summary.summary", {
    vars: { active: String(categoryActive), archived: String(categoryArchived) },
  });

  const workSourceSummary =
    workSourceCount === 0
      ? t("settings.work_sources_summary.summary_zero")
      : t("settings.work_sources_summary.summary", {
          vars: { count: String(workSourceCount) },
        });

  const accountsSummary = t("settings.accounts_summary.summary", {
    vars: {
      accounts: String(accountCount),
      institutions: String(institutionCount),
    },
  });

  return (
    <div className="feed fade-in settings-page" style={{ animationDelay: "60ms" }}>
      <div className="section">
        <div className="section-hd">
          <div className="ttl mono">
            <b>{t("settings.title")}</b>
          </div>
        </div>
        <div className="section-body">

          {/* 1. Profile */}
          <ProfileSection
            name={user?.name ?? null}
            gender={user?.gender ?? "UNSPECIFIED"}
          />

          <div className="settings-divider" />

          {/* 2. Localization */}
          <div className="settings-section">
            <div className="settings-section-title mono">
              {t("settings.locale.sectionTitle")}
            </div>
            <LocaleSwitcher />
          </div>

          <div className="settings-divider" />

          {/* 3. Budget */}
          <BudgetSection
            activeMode={budgetSettings?.activeMode ?? "NORMAL"}
            primaryCurrencyCode={budgetSettings?.primaryCurrencyCode ?? "RUB"}
          />

          <div className="settings-divider" />

          {/* 4. Categories */}
          <LinkSection
            title={t("settings.categories_summary.section_title")}
            summary={categorySummary}
            href="/settings/categories"
            linkLabel={t("settings.link.manage")}
          />

          <div className="settings-divider" />

          {/* 5. Work sources */}
          <LinkSection
            title={t("settings.work_sources_summary.section_title")}
            summary={workSourceSummary}
            href="/income"
            linkLabel={t("settings.link.manage")}
          />

          <div className="settings-divider" />

          {/* 6. Accounts & institutions */}
          <LinkSection
            title={t("settings.accounts_summary.section_title")}
            summary={accountsSummary}
            href="/wallet"
            linkLabel={t("settings.link.manage")}
          />

          <div className="settings-divider" />

          {/* 7. Integrations */}
          <IntegrationsSection />

          <div className="settings-divider" />

          {/* 8. Export */}
          <ExportSection />

          <div className="settings-divider" />

          {/* 9. Danger zone */}
          <DangerZone />

        </div>
      </div>
    </div>
  );
}
