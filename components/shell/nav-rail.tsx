"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEM_HEIGHT, NAV_TABS, NAV_TOP_PADDING, SETTINGS_TAB } from "@/lib/nav";
import { useT } from "@/lib/i18n";

function activeIndex(pathname: string): number | null {
  // Pick the longest matching href (so /transactions beats /). Root ('/') only
  // matches when pathname is exactly '/'. Returns null if nothing matches — that
  // happens e.g. on /settings where the indicator should hide.
  let best: number | null = null;
  let bestLen = 0;
  NAV_TABS.forEach((tab, i) => {
    const h = tab.href;
    if (h === "/" ? pathname === "/" : pathname.startsWith(h)) {
      if (h.length > bestLen) {
        best = i;
        bestLen = h.length;
      }
    }
  });
  return best;
}

/* Small stroke-based gear icon. Monochrome, inherits color, matches the
   rest of the terminal-quant line weight (1.5px stroke, sharp corners). */
function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function NavRail() {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const active = activeIndex(pathname);
  const indicatorTop = active === null ? -100 : NAV_TOP_PADDING + active * NAV_ITEM_HEIGHT;
  const settingsActive = pathname.startsWith(SETTINGS_TAB.href);

  return (
    <nav className="nav-rail" aria-label={t("shell.nav.aria")}>
      <span
        className="indicator"
        style={{ top: indicatorTop, opacity: active === null ? 0 : 1 }}
        aria-hidden
      />
      {NAV_TABS.map((tab, i) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`nav-item${i === active ? " active" : ""}`}
          aria-current={i === active ? "page" : undefined}
        >
          <span className="icon">{tab.icon}</span>
          <span className="code">{t(tab.codeKey)}</span>
          <span className="label-full mono">{t(tab.labelKey)}</span>
          <span className="tip">{t(tab.labelKey)}</span>
        </Link>
      ))}

      <div className="nav-spacer" aria-hidden />

      <Link
        href={SETTINGS_TAB.href}
        className={`nav-item nav-settings${settingsActive ? " active" : ""}`}
        aria-current={settingsActive ? "page" : undefined}
      >
        <span className="icon"><SettingsIcon /></span>
        <span className="code">{t(SETTINGS_TAB.codeKey)}</span>
        <span className="label-full mono">{t(SETTINGS_TAB.labelKey)}</span>
        <span className="tip">{t(SETTINGS_TAB.labelKey)}</span>
      </Link>
    </nav>
  );
}
