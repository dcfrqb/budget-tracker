"use client";

// ─────────────────────────────────────────────────────────────
// Locale context — client module
// Locale is resolved server-side from cookie and passed as a
// prop to <LocaleClientProvider>. No localStorage, no effects.
// ─────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext } from "react";
import type { Locale, TOptions } from "./types";
import type { TKey } from "./t";
import { DEFAULT_LOCALE } from "./types";
import { t as tFn } from "./t";

type LocaleContextValue = {
  locale: Locale;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
});

/** Server → client bridge: accepts locale resolved from cookie. */
export function LocaleClientProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale }}>
      {children}
    </LocaleContext.Provider>
  );
}

/** Returns current locale from context. */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** Returns a t() function bound to the locale from context. */
export function useT(): (key: TKey, options?: TOptions) => string {
  const locale = useLocale();
  return useCallback(
    (key: TKey, options?: TOptions) => tFn(locale, key, options),
    [locale],
  );
}
