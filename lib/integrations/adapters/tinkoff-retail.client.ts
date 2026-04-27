// SECURITY: ALL outbound HTTP goes through httpFetch from "@/lib/integrations/http".
// Do NOT call fetch() directly in this file.

import { randomBytes } from "node:crypto";
import { httpFetch } from "@/lib/integrations/http";

export const TINKOFF_API_BASE = "https://www.tbank.ru/api/common/v1";

export const TINKOFF_COMMON_QUERY = {
  appName: "supreme",
  appVersion: "0.0.1",
  origin: "web,ib5,platform",
} as const;

export const TINKOFF_REQUEST_FIELDS = {
  session: [] as const,
  signUp: ["phone", "password"] as const,
  confirm: ["confirmationCode", "ticket"] as const,
  levelUp: [] as const,
} as const;

// ─────────────────────────────────────────────────────────────
// Error class
// ─────────────────────────────────────────────────────────────

export type TinkoffErrorCode =
  | "INSUFFICIENT_PRIVILEGES"
  | "WAITING_CONFIRMATION"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "UNKNOWN";

export class TinkoffApiError extends Error {
  readonly code: TinkoffErrorCode;
  readonly requiredAccessLevel?: number;
  readonly trackingId?: string;

  constructor(
    code: TinkoffErrorCode,
    message: string,
    opts?: { requiredAccessLevel?: number; trackingId?: string },
  ) {
    super(message);
    this.name = "TinkoffApiError";
    this.code = code;
    this.requiredAccessLevel = opts?.requiredAccessLevel;
    this.trackingId = opts?.trackingId;
  }
}

// ─────────────────────────────────────────────────────────────
// Response parser
// ─────────────────────────────────────────────────────────────

function mapResultCode(resultCode: string): TinkoffErrorCode {
  switch (resultCode) {
    case "INSUFFICIENT_PRIVILEGES":
      return "INSUFFICIENT_PRIVILEGES";
    case "WAITING_CONFIRMATION":
      return "WAITING_CONFIRMATION";
    case "INVALID_CREDENTIALS":
    case "WRONG_CREDENTIALS":
      return "INVALID_CREDENTIALS";
    case "RATE_LIMITED":
    case "TOO_MANY_REQUESTS":
      return "RATE_LIMITED";
    default:
      return "UNKNOWN";
  }
}

export function parseTinkoffResponse<T>(
  json: unknown,
): { payload: T; trackingId?: string } {
  if (json === null || typeof json !== "object") {
    throw new TinkoffApiError("UNKNOWN", "Response is not an object");
  }

  const obj = json as Record<string, unknown>;
  const resultCode = typeof obj.resultCode === "string" ? obj.resultCode : "UNKNOWN";
  const trackingId = typeof obj.trackingId === "string" ? obj.trackingId : undefined;

  if (resultCode !== "OK") {
    const errorMessage =
      typeof obj.errorMessage === "string"
        ? obj.errorMessage
        : `T-Bank error: ${resultCode}`;
    const code = mapResultCode(resultCode);
    const requiredAccessLevel =
      typeof obj.requiredAccessLevel === "number"
        ? obj.requiredAccessLevel
        : undefined;
    throw new TinkoffApiError(code, errorMessage, { requiredAccessLevel, trackingId });
  }

  return { payload: obj.payload as T, trackingId };
}

// ─────────────────────────────────────────────────────────────
// URL builder
// ─────────────────────────────────────────────────────────────

export function buildUrl(
  endpoint: string,
  params: Record<string, string | number | undefined>,
): string {
  const url = new URL(`${TINKOFF_API_BASE}/${endpoint.replace(/^\//, "")}`);

  // Always include common query params
  for (const [k, v] of Object.entries(TINKOFF_COMMON_QUERY)) {
    url.searchParams.set(k, String(v));
  }

  // Add extra params, skipping undefined
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) {
      url.searchParams.set(k, String(v));
    }
  }

  return url.toString();
}

// ─────────────────────────────────────────────────────────────
// HTTP wrappers
// ─────────────────────────────────────────────────────────────

export async function tinkoffPost(
  endpoint: string,
  sessionid: string | undefined,
  wuid: string | undefined,
  body: Record<string, string>,
): Promise<unknown> {
  const params: Record<string, string | undefined> = {};
  if (sessionid) params.sessionid = sessionid;
  if (wuid) params.wuid = wuid;

  const url = buildUrl(endpoint, params);
  const response = await httpFetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  return response.json();
}

export async function tinkoffGet(
  endpoint: string,
  sessionid: string,
  wuid: string,
  queryExtras?: Record<string, string | number>,
): Promise<unknown> {
  const params: Record<string, string | number | undefined> = {
    sessionid,
    wuid,
    ...queryExtras,
  };

  const url = buildUrl(endpoint, params);
  const response = await httpFetch(url, { method: "GET" });
  return response.json();
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export function generateWuid(): string {
  return randomBytes(16).toString("hex");
}
