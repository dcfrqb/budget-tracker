// ─────────────────────────────────────────────────────────────
// Pure translation function — no React dependency
// ─────────────────────────────────────────────────────────────

import type { Locale, TOptions } from "./types";
import type { RuDict } from "./locales/ru";
import type { PathsOf } from "./types";
import { DICTS, resolveKey } from "./dict";

export type TKey = PathsOf<RuDict>;

/**
 * Resolves a translation key for the given locale.
 * - Falls back to "ru" if key is missing in the requested locale.
 * - Falls back to the key itself (with console.warn in dev) if missing in both.
 * - Interpolates {placeholder} with vars values.
 */
export function t(locale: Locale, key: TKey, options?: TOptions): string {
  const dict = DICTS[locale];
  let raw = resolveKey(dict, key as string);

  if (raw === undefined && locale !== "ru") {
    raw = resolveKey(DICTS["ru"], key as string);
  }

  if (raw === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] missing key: "${key}" for locale "${locale}"`);
    }
    return key as string;
  }

  if (!options?.vars) return raw;

  return raw.replace(/\{(\w+)\}/g, (match, k: string) => {
    const val = options.vars?.[k];
    return val !== undefined ? String(val) : match;
  });
}
