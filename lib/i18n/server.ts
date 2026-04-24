import "server-only";
// ─────────────────────────────────────────────────────────────
// i18n server API — server components and server functions only
// ─────────────────────────────────────────────────────────────

import { cookies } from "next/headers";
import { DEFAULT_LOCALE } from "./types";
import type { Locale, TOptions } from "./types";
import { t as tFn } from "./t";
import type { TKey } from "./t";

const COOKIE_KEY = "bdg:locale";

/** Reads locale from cookie. Falls back to DEFAULT_LOCALE. */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const v = jar.get(COOKIE_KEY)?.value;
  return v === "en" || v === "ru" ? v : DEFAULT_LOCALE;
}

/**
 * Returns a t() function bound to the given locale.
 * If locale is omitted, reads it from cookie via getLocale().
 */
export async function getT(
  locale?: Locale,
): Promise<(key: TKey, options?: TOptions) => string> {
  const resolved = locale ?? (await getLocale());
  return (key: TKey, options?: TOptions) => tFn(resolved, key, options);
}
