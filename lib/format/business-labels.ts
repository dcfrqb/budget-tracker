// ─────────────────────────────────────────────────────────────
// Business stream/tariff labels — streamKey/tariff are FREE-TEXT
// user inputs. Only a hand-curated known set has i18n labels;
// anything else must render verbatim (raw user string), not
// routed through t() as a dynamic key (would render as a broken
// key like "business.stream.Upwork").
// ─────────────────────────────────────────────────────────────

import type { TKey } from "@/lib/i18n/t";
import type { TOptions } from "@/lib/i18n/types";

type TFn = (key: TKey, options?: TOptions) => string;

const KNOWN_STREAM_KEYS = ["bot", "arcadia", "zakhar", "manual", "esp", "evo", "other"] as const;
const KNOWN_TARIFF_KEYS = ["lite", "standard", "pro", "premium", "other"] as const;

type KnownStreamKey = (typeof KNOWN_STREAM_KEYS)[number];
type KnownTariffKey = (typeof KNOWN_TARIFF_KEYS)[number];

function isKnownStreamKey(v: string): v is KnownStreamKey {
  return (KNOWN_STREAM_KEYS as readonly string[]).includes(v);
}

function isKnownTariffKey(v: string): v is KnownTariffKey {
  return (KNOWN_TARIFF_KEYS as readonly string[]).includes(v);
}

/**
 * Resolves a display label for a free-text business stream key.
 * Known values (bot/arcadia/zakhar/manual/esp/evo) get a translated
 * label. `null`/`other` render the translated "other" placeholder.
 * Anything else (arbitrary user text) is returned verbatim.
 */
export function resolveStreamLabel(
  t: TFn,
  stream: string | null | undefined,
): string {
  if (stream == null || stream === "") return t("business.stream.other");
  if (isKnownStreamKey(stream)) return t(`business.stream.${stream}`);
  return stream;
}

/**
 * Resolves a display label for a free-text business tariff.
 * Known values (lite/standard/pro/premium) get a translated label.
 * `null`/`other` render the translated "other" placeholder.
 * Anything else (arbitrary user text) is returned verbatim.
 */
export function resolveTariffLabel(
  t: TFn,
  tariff: string | null | undefined,
): string {
  if (tariff == null || tariff === "") return t("business.tariff.other");
  if (isKnownTariffKey(tariff)) return t(`business.tariff.${tariff}`);
  return tariff;
}
