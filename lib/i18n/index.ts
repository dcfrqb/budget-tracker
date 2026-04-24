// ─────────────────────────────────────────────────────────────
// i18n public API (client-safe)
//
// Server components / server functions — use @/lib/i18n/server:
//   import { getLocale, getT } from "@/lib/i18n/server"
//
// Client components — use @/lib/i18n:
//   import { useT, useLocale, LocaleClientProvider } from "@/lib/i18n"
//
// Barrel split сознательный: server.ts декорирован "server-only",
// любой re-export оттуда отравляет клиентский граф импортов.
// ─────────────────────────────────────────────────────────────

// Client-side API (context + hook)
export { useT, useLocale, LocaleClientProvider } from "./context";

// Shared types
export { DEFAULT_LOCALE } from "./types";
export type { Locale, TOptions } from "./types";
export type { TKey } from "./t";
