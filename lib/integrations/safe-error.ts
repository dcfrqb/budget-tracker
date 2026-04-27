// ─────────────────────────────────────────────────────────────
// Safe error classification for integration sync logs.
//
// SECURITY: raw error messages from HTTP adapters may contain
// credentials, tokens, phone numbers, or PII. This module:
//   1. Classifies errors by type (never exposing raw messages to client).
//   2. Sanitizes messages before writing to DB (lastErrorMessage / errorClass).
//   3. Ensures no sensitive data leaks into IntegrationSyncLog rows.
//
// Redaction examples (verified patterns below):
//   "Bearer eyJhbGciOiJSUzI1..."   → "Bearer [REDACTED]"
//   "+79161234567"                  → "[REDACTED]"
//   "4276 1600 1234 5678"           → "[REDACTED]"
//   "code: 123456"                  → "code: [REDACTED]"
//   '{"authorization":"secret"}'    → '{"authorization":"[REDACTED]"}'
//   '{"password":"hunter2"}'        → '{"password":"[REDACTED]"}'
// ─────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "password",
  "accesstoken",
  "refreshtoken",
  "session",
  "code",
  "otp",
  "phone",
  "encryptedpayload",
] as const;

const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  // Bearer tokens (JWT or opaque)
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  // Russian phone numbers
  /\+7\d{10}/g,
  // Card-like 16-digit numbers (with optional spaces)
  /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
  // 6-digit OTP-like codes — applied last to reduce false positives
  /\b\d{6}\b/g,
];

const MAX_MESSAGE_LENGTH = 500;

// Redact credential-bearing URL query parameters that may appear in error messages
// if a network library or future code path ever includes the full request URL.
// Covers sessionid=, wuid=, and password= as query params or standalone key=value pairs.
export function redactCredsFromString(s: string): string {
  return s
    .replace(/sessionid=[^&\s"]+/gi, "sessionid=[REDACTED]")
    .replace(/wuid=[^&\s"]+/gi, "wuid=[REDACTED]")
    .replace(/password=[^&\s"]+/gi, "password=[REDACTED]");
}

export type SafeError = {
  /** Short label for DB errorClass field: "fetch_timeout" | "401" | "decrypt_failure" | "json_parse" | "unknown" */
  class: string;
  /** Sanitized message safe for DB storage and log display. No PII. */
  message: string;
};

function classifyError(e: unknown): string {
  if (e instanceof Error) {
    const name = e.name;

    // TinkoffApiError — duck-typed to avoid circular import from adapter layer.
    // Produces "tinkoff:<CODE>" or "tinkoff:<CODE>@trk_<trackingId>".
    if (
      name === "TinkoffApiError" &&
      "code" in e &&
      typeof (e as Record<string, unknown>).code === "string"
    ) {
      const tinkoffCode = (e as Record<string, unknown>).code as string;
      const trackingId = (e as Record<string, unknown>).trackingId;
      const suffix =
        typeof trackingId === "string" ? `@trk_${trackingId}` : "";
      return `tinkoff:${tinkoffCode}${suffix}`;
    }

    // AbortError from AbortController timeout
    if (name === "AbortError" || name === "TimeoutError") return "fetch_timeout";
    // Non-HTTPS URL blocked by httpFetch
    if (e.message.startsWith("http_not_allowed")) return "http_not_allowed";
    // Decipher errors from node:crypto
    if (
      name === "Error" &&
      (e.message.includes("Unsupported state") ||
        e.message.includes("bad decrypt") ||
        e.message.includes("unknown_key_version") ||
        e.message.startsWith("decrypt_failure"))
    ) {
      return "decrypt_failure";
    }
    // JSON parse errors
    if (name === "SyntaxError") return "json_parse";
  }

  // HTTP status code (adapters may attach .status)
  if (
    e !== null &&
    typeof e === "object" &&
    "status" in e &&
    typeof (e as Record<string, unknown>).status === "number"
  ) {
    return String((e as Record<string, unknown>).status);
  }

  // Classify plain-object or non-Error throws by message prefix.
  // Covers httpFetch throwing http_not_allowed on non-HTTPS URLs,
  // and any rethrown decrypt failures that lost their Error type.
  if (typeof e === "object" && e !== null && "message" in e) {
    const msg = String((e as Record<string, unknown>).message);
    if (msg.startsWith("http_not_allowed")) return "http_not_allowed";
    if (msg.startsWith("unknown_key_version")) return "decrypt_failure";
  }

  return "unknown";
}

function sanitizeMessage(raw: string): string {
  let msg = raw;

  // Redact JSON key-value pairs for sensitive keys
  // Matches: "key":"value" or "key": "value" (both quoted strings and unquoted tokens)
  for (const key of SENSITIVE_KEYS) {
    // JSON string value: "key":"anything" or "key": "anything"
    const jsonPattern = new RegExp(
      `("${key}"\\s*:\\s*)"[^"]*"`,
      "gi",
    );
    msg = msg.replace(jsonPattern, `$1"[REDACTED]"`);
  }

  // Redact value patterns
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    msg = msg.replace(pattern, "[REDACTED]");
  }

  // Redact credential-bearing URL query params (last pass, after key-based redaction)
  msg = redactCredsFromString(msg);

  // Truncate
  if (msg.length > MAX_MESSAGE_LENGTH) {
    msg = msg.slice(0, MAX_MESSAGE_LENGTH) + "…";
  }

  return msg;
}

export function toSafeError(e: unknown): SafeError {
  const errorClass = classifyError(e);

  let rawMessage = "unknown error";
  if (e instanceof Error) {
    rawMessage = e.message;
  } else if (typeof e === "string") {
    rawMessage = e;
  } else if (e !== null && typeof e === "object" && "message" in e) {
    rawMessage = String((e as Record<string, unknown>).message);
  }

  const safeMessage = sanitizeMessage(rawMessage);

  return {
    class: errorClass,
    message: safeMessage,
  };
}
