"use client";

// ─────────────────────────────────────────────────────────────
// Locale context — client module
// Locale + resolved dictionary are passed as props from the
// server layout. The client never imports locale dictionaries
// directly — only the active one is serialized into the page.
// ─────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useMemo } from "react";
import type { Locale, Dict, TOptions } from "./types";
import type { TKey } from "./t";
import { DEFAULT_LOCALE } from "./types";

// ── Lightweight client-side key resolver ────────────────────
// Does NOT import DICTS (which would pull both locale files).
// Uses only the dict passed as a prop by the server.
function resolveKey(dict: Dict, path: string): string | undefined {
  const parts = path.split(".");
  let node: string | Dict = dict;
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Dict)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function applyVars(raw: string, vars?: Record<string, string | number>): string {
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, k: string) => {
    const val = vars[k];
    return val !== undefined ? String(val) : match;
  });
}

// ── Context ──────────────────────────────────────────────────

type LocaleContextValue = {
  locale: Locale;
  /** Resolved dictionary for the active locale — only one locale is included. */
  dict: Dict;
};

// Empty dict as default to avoid null checks; real dict comes from provider.
const EMPTY_DICT: Dict = {};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  dict: EMPTY_DICT,
});

// ── Provider ─────────────────────────────────────────────────

/**
 * Server → client bridge.
 * Accepts locale + the pre-resolved dictionary for that locale.
 * Only the active locale's dictionary is serialized to the client.
 */
export function LocaleClientProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  children: React.ReactNode;
}) {
  // Memoize so consumers only re-render when locale actually changes.
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dict }),
    [locale, dict],
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────

/** Returns current locale from context. */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** Returns a t() function bound to the locale dictionary from context. */
export function useT(): (key: TKey, options?: TOptions) => string {
  const { dict } = useContext(LocaleContext);
  return useCallback(
    (key: TKey, options?: TOptions) => {
      const raw = resolveKey(dict, key as string);
      if (raw === undefined) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[i18n] missing key: "${key as string}"`);
        }
        return key as string;
      }
      return applyVars(raw, options?.vars);
    },
    [dict],
  );
}
