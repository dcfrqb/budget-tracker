"use client";

import { usePathname } from "next/navigation";
import { findTabForPath } from "@/lib/nav";
import { useT } from "@/lib/i18n";

export function TopBarCrumbs() {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const tab = findTabForPath(pathname);

  const SECONDARY: Record<string, string> = {
    home: t("shell.crumbs.home"),
    txn:  t("shell.crumbs.txn"),
    inc:  t("shell.crumbs.inc"),
    exp:  t("shell.crumbs.exp"),
    plan: t("shell.crumbs.plan"),
    anl:  t("shell.crumbs.anl"),
    wal:  t("shell.crumbs.wal"),
    fam:  t("shell.crumbs.fam"),
    settings: t("shell.crumbs.settings"),
  };

  // Deeper sub-paths within sections that need a third crumb
  const SECONDARY_BY_PATH: Record<string, string> = {
    "/settings/categories":  t("shell.crumbs.settings_sub.categories"),
    "/wallet/integrations":  t("shell.crumbs.wal_sub.integrations"),
  };

  const tabLabel = tab ? t(tab.labelKey).toLowerCase() : "—";
  const secondaryCrumb = tab ? (SECONDARY[tab.id] ?? "—") : "—";

  // Third crumb: only show on home page (date) or when a deeper sub-path matches
  const subPathCrumb = SECONDARY_BY_PATH[pathname] ?? null;
  const thirdCrumb = pathname === "/" ? new Date().toISOString().slice(0, 10) : subPathCrumb;

  return (
    <span className="path mono">
      <b>{tabLabel}</b>
      <span className="sep">/</span>
      {secondaryCrumb}
      {thirdCrumb && (
        <>
          <span className="sep">/</span>
          {thirdCrumb}
        </>
      )}
    </span>
  );
}
