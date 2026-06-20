// ─────────────────────────────────────────────────────────────
// Merchant name normalisation + similarity
// ─────────────────────────────────────────────────────────────

// Processor prefix patterns to strip: "PADDLE.NET* ", "PAYPAL * ", "SQ * ", "TAP* ", etc.
// Pattern: one or two word tokens, optional dot-separated, optionally suffixed with *, followed by space.
const PROCESSOR_PREFIX_RE = /^(?:paddle\.net|paypal|paypal\.com|sq|tap|stripe)[. *]+/i;

// TLD suffixes to strip
const TLD_RE = /\.(com|net|org|io|ru|co|app|ai|dev|biz|info)(\b|$)/gi;

// Generic billing words
const BILLING_WORDS_RE =
  /\b(subscr(?:iption)?|payment|recurring|monthly|billing|inc|ltd|llc|gmbh)\b/gi;

// Non-alphanumeric collapse (keep spaces for word boundary purposes)
const NON_ALNUM_RE = /[^a-z0-9\s]/g;

const MULTI_SPACE_RE = /\s{2,}/g;

/**
 * Normalises a raw merchant/transaction name for fuzzy matching.
 *
 * Pipeline:
 * 1. NFKD decomposition + strip combining diacritics
 * 2. Lowercase
 * 3. Strip processor prefix wrappers (PADDLE.NET*, PAYPAL *, SQ *, TAP*)
 * 4. Strip TLD suffixes (.com/.net/.org/.io/.ru etc.)
 * 5. Remove generic billing words
 * 6. Collapse non-alphanumerics to spaces
 * 7. Trim + collapse repeated spaces
 *
 * Examples (per spec):
 *   "OPENAI *CHATGPT SUBSCR"        → "openai chatgpt"
 *   "HOSTVDS.COM"                   → "hostvds"
 *   "PADDLE.NET* IHUNTER"           → "ihunter"
 *   "Google YouTubePremium"         → "google youtubepremium"
 *   "NETFLIX.COM"                   → "netflix"
 *   "ANTHROPIC"                     → "anthropic"
 */
export function normalizeMerchant(raw: string): string {
  if (!raw || !raw.trim()) return "";

  // NFKD + strip diacritics
  let s = raw.normalize("NFKD").replace(/[̀-ͯ]/g, "");

  // Lowercase
  s = s.toLowerCase();

  // Strip processor prefix (e.g. "paddle.net* ", "paypal * ", "sq * ", "tap* ")
  s = s.replace(PROCESSOR_PREFIX_RE, "");

  // Strip TLD suffixes
  s = s.replace(TLD_RE, " ");

  // Remove generic billing words
  s = s.replace(BILLING_WORDS_RE, " ");

  // Collapse non-alphanumerics to spaces
  s = s.replace(NON_ALNUM_RE, " ");

  // Collapse whitespace and trim
  s = s.replace(MULTI_SPACE_RE, " ").trim();

  return s;
}

/**
 * Jaccard similarity over word tokens of two normalised merchant strings.
 * Returns a value in [0, 1]. Returns 0 if either string normalises to empty.
 */
export function merchantSimilarity(a: string, b: string): number {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na || !nb) return 0;

  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}
