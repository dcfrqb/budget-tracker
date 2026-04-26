import type { TKey } from "@/lib/i18n/t";

export type NavTab = {
  id: string;
  href: string;
  icon: string;       // unicode glyph used in rail
  codeKey: TKey;      // i18n key → 3-letter code under icon
  labelKey: TKey;     // i18n key → tooltip / full name
};

export const NAV_TABS: NavTab[] = [
  { id: "home", href: "/",             icon: "⌂", codeKey: "shell.nav.codes.home", labelKey: "shell.nav.tabs.home" },
  { id: "txn",  href: "/transactions", icon: "↕", codeKey: "shell.nav.codes.txn",  labelKey: "shell.nav.tabs.txn"  },
  { id: "inc",  href: "/income",       icon: "↑", codeKey: "shell.nav.codes.inc",  labelKey: "shell.nav.tabs.inc"  },
  { id: "exp",  href: "/expenses",     icon: "↓", codeKey: "shell.nav.codes.exp",  labelKey: "shell.nav.tabs.exp"  },
  { id: "plan", href: "/planning",     icon: "◈", codeKey: "shell.nav.codes.plan", labelKey: "shell.nav.tabs.plan" },
  { id: "anl",  href: "/analytics",   icon: "∿", codeKey: "shell.nav.codes.anl",  labelKey: "shell.nav.tabs.anl"  },
  { id: "wal",  href: "/wallet",       icon: "◎", codeKey: "shell.nav.codes.wal",  labelKey: "shell.nav.tabs.wal"  },
  { id: "fam",  href: "/family",       icon: "◉", codeKey: "shell.nav.codes.fam",  labelKey: "shell.nav.tabs.fam"  },
];

export const NAV_ITEM_HEIGHT = 56;
export const NAV_TOP_PADDING = 6;

/** Отдельная «нижняя» вкладка — настройки. Не входит в основной NAV_TABS,
 *  пинится к низу рельсы и отделена тонким разделителем. */
export const SETTINGS_TAB: Omit<NavTab, "icon"> = {
  id: "settings",
  href: "/settings",
  codeKey: "shell.nav.codes.settings",
  labelKey: "shell.nav.tabs.settings",
};

/** Find the active tab for a given pathname.
 *  Checks NAV_TABS first (exact match for "/", prefix match for others),
 *  then falls back to SETTINGS_TAB if pathname starts with "/settings".
 *  Returns null if no tab matches (shouldn't happen in normal navigation). */
export function findTabForPath(pathname: string): NavTab | Omit<NavTab, "icon"> | null {
  const mainMatch = NAV_TABS.find((t) =>
    t.href === "/" ? pathname === "/" : pathname.startsWith(t.href),
  );
  if (mainMatch) return mainMatch;

  if (pathname === SETTINGS_TAB.href || pathname.startsWith(SETTINGS_TAB.href + "/")) {
    return SETTINGS_TAB;
  }

  return null;
}
