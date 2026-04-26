// ─────────────────────────────────────────────────────────────
// Centralised HTTP client for integration adapters.
//
// SECURITY: ALL outbound HTTP from integration adapters MUST
// go through httpFetch(). This enforces:
//   1. HTTPS-only (rejects http:// URLs).
//   2. Realistic browser User-Agent (required by Tinkoff mobile API).
//   3. Hard timeout via AbortController (default 15s).
//
// Do NOT call fetch() directly in adapter code.
// ─────────────────────────────────────────────────────────────

const REALISTIC_UA =
  "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const DEFAULT_TIMEOUT_MS = 15_000;

export type HttpFetchOptions = RequestInit & {
  /** Override default 15s timeout. */
  timeoutMs?: number;
};

/**
 * Fetch wrapper for integration adapters.
 *
 * Throws:
 *   - Error("http_not_allowed: ...") if URL is not HTTPS.
 *   - AbortError if request exceeds timeoutMs.
 *   - Any network error from fetch.
 *
 * Does NOT throw on non-2xx status — caller must check response.ok.
 */
export async function httpFetch(
  url: string,
  init: HttpFetchOptions = {},
): Promise<Response> {
  // 1. Reject non-https
  if (!url.startsWith("https://")) {
    throw new Error("http_not_allowed: integration adapters must use HTTPS");
  }

  // 2. Apply timeout via AbortController
  const { timeoutMs, ...fetchInit } = init;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // 3. Merge headers with defaults
  const headers = new Headers(fetchInit.headers);
  if (!headers.has("user-agent")) {
    headers.set("user-agent", REALISTIC_UA);
  }
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  try {
    return await fetch(url, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
