"use client";

import { usePathname } from "next/navigation";
import { NAV_TABS } from "@/lib/nav";

function activeTab(pathname: string) {
  return (
    NAV_TABS.find((t) => (t.href === "/" ? pathname === "/" : pathname.startsWith(t.href))) ??
    NAV_TABS[0]
  );
}

const SECONDARY: Record<string, string> = {
  home: "обзор",
  txn:  "лента",
  inc:  "источники",
  exp:  "обязательства",
  plan: "календарь",
  anl:  "погода",
  wal:  "счета",
  fam:  "группа",
};

export function TopBarCrumbs() {
  const pathname = usePathname() ?? "/";
  const tab = activeTab(pathname);

  return (
    <span className="path mono">
      <b>{tab.label.toLowerCase()}</b>
      <span className="sep">/</span>
      {SECONDARY[tab.id] ?? "—"}
      <span className="sep">/</span>
      {new Date().toISOString().slice(0, 10)}
    </span>
  );
}
