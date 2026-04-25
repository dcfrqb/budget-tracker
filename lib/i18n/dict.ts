import "server-only";
// ─────────────────────────────────────────────────────────────
// Dict registry and key resolver — SERVER ONLY
// Both locale dicts live here. The client receives only the
// active locale's dict via LocaleClientProvider prop.
// ─────────────────────────────────────────────────────────────

import type { Locale, Dict } from "./types";
import { ruDict } from "./locales/ru";
import { enDict } from "./locales/en";

export const DICTS: Record<Locale, Dict> = {
  ru: ruDict as unknown as Dict,
  en: enDict as unknown as Dict,
};

/**
 * Resolves a dot-separated key path in a dictionary.
 * Returns the string value or undefined if not found.
 * Example: resolveKey(dict, "expenses.subscriptions.card.perMonth")
 */
export function resolveKey(dict: Dict, path: string): string | undefined {
  const parts = path.split(".");
  let node: string | Dict = dict;
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Dict)[part];
  }
  return typeof node === "string" ? node : undefined;
}
