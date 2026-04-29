import type { ZodSchema } from "zod";
import { signV5 } from "./sign";
import { bybitServerTimeSchema, classifyRetCode } from "./zod";
import { BybitApiError } from "./types";
import type { BybitErrorClass } from "./types";

const BASE_URL = "https://api.bybit.com";
const RECV_WINDOW = 20_000;
const MIN_CALL_INTERVAL_MS = 1_000;

function getRequestUrl(path: string): string {
  const base = process.env["BYBIT_PROXY_URL"] ?? BASE_URL;
  return `${base.replace(/\/$/, "")}${path}`;
}

// ── Server-time offset (in-memory, per module lifetime) ──────────────────────

let serverTimeOffsetMs = 0;
let serverTimeSynced = false;

async function syncServerTime(): Promise<void> {
  const url = getRequestUrl("/v5/market/time");
  const localBefore = Date.now();
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const localAfter = Date.now();
  if (!res.ok) return;

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return;
  }

  const parsed = bybitServerTimeSchema.safeParse(raw);
  if (!parsed.success) return;

  const serverMs = Number(parsed.data.result.timeSecond) * 1000;
  const roundTripHalf = Math.floor((localAfter - localBefore) / 2);
  serverTimeOffsetMs = serverMs - (localBefore + roundTripHalf);
  serverTimeSynced = true;
}

function nowWithOffset(): number {
  return Date.now() + serverTimeOffsetMs;
}

// ── Rate-limit: single slot, 1 RPS ───────────────────────────────────────────

let lastCallAt = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < MIN_CALL_INTERVAL_MS) {
    await sleep(MIN_CALL_INTERVAL_MS - elapsed);
  }
  lastCallAt = Date.now();
}

// ── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyFetchError(e: unknown): BybitErrorClass {
  if (e instanceof BybitApiError) return e.class;
  return "network_error";
}

// ── Main fetch wrapper ────────────────────────────────────────────────────────

export type BybitFetchInput<TBody> = {
  apiKey: string;
  apiSecret: string;
  path: string;
  method: "POST" | "GET";
  body?: TBody;
  schema: ZodSchema;
};

export async function bybitFetch<TBody, TResult>(
  input: BybitFetchInput<TBody>,
): Promise<TResult> {
  if (!serverTimeSynced) {
    await syncServerTime();
  }

  const { apiKey, apiSecret, path, method, body, schema } = input;
  const bodyJson = body !== undefined ? JSON.stringify(body) : "";

  const MAX_ATTEMPTS = 3;
  let attempt = 0;
  let backoffMs = 1_000;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;

    await throttle();

    const timestamp = nowWithOffset();
    const authHeaders = signV5({
      apiKey,
      apiSecret,
      timestamp,
      recvWindow: RECV_WINDOW,
      bodyJson,
    });

    const headers: Record<string, string> = {
      ...authHeaders,
      accept: "application/json",
    };
    if (method === "POST") {
      headers["content-type"] = "application/json";
    }

    if (process.env["BYBIT_DEBUG"] === "1") {
      console.log("[bybit req]", method, path, bodyJson);
    }

    let res: Response;
    try {
      res = await fetch(getRequestUrl(path), {
        method,
        headers,
        body: method === "POST" ? bodyJson : undefined,
      });
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) {
        throw new BybitApiError({
          retCode: -1,
          retMsg: String(e instanceof Error ? e.message : e),
          class: "network_error",
          cause: e,
        });
      }
      await sleep(backoffMs);
      backoffMs *= 2;
      continue;
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch (e) {
      throw new BybitApiError({
        retCode: -1,
        retMsg: "Failed to parse JSON response",
        class: "parse_error",
        cause: e,
      });
    }

    if (process.env["BYBIT_DEBUG"] === "1") {
      console.log("[bybit raw]", JSON.stringify(raw, null, 2));
    }

    // Check retCode before schema validation to handle retry logic
    const envelope = raw as { retCode?: number; retMsg?: string };
    const retCode = typeof envelope?.retCode === "number" ? envelope.retCode : -1;

    if (retCode === 10002) {
      // Timestamp drift — resync and retry once
      await syncServerTime();
      if (attempt >= MAX_ATTEMPTS) {
        throw new BybitApiError({
          retCode,
          retMsg: envelope?.retMsg ?? "timestamp out of window",
          class: "timestamp_drift",
        });
      }
      continue;
    }

    if (retCode === 10006) {
      // Rate limit — back off and retry
      if (attempt >= MAX_ATTEMPTS) {
        throw new BybitApiError({
          retCode,
          retMsg: envelope?.retMsg ?? "rate limit exceeded",
          class: "rate_limit",
        });
      }
      await sleep(backoffMs);
      backoffMs *= 2;
      continue;
    }

    if (retCode === 10003 || retCode === 10004) {
      throw new BybitApiError({
        retCode,
        retMsg: envelope?.retMsg ?? "auth failed",
        class: "auth_failed",
      });
    }

    if (retCode === 10005) {
      throw new BybitApiError({
        retCode,
        retMsg: envelope?.retMsg ?? "invalid signature",
        class: "sign_invalid",
      });
    }

    // Generic catch-all: any other non-zero retCode is a hard error from Bybit
    // (e.g., 120110001 "param_illegal", IP not in allowlist, etc.). Throw with
    // "unknown" class so callers see retCode + retMsg verbatim instead of a
    // misleading schema-validation error.
    if (retCode !== 0) {
      throw new BybitApiError({
        retCode,
        retMsg: envelope?.retMsg ?? "Bybit API error",
        class: "unknown",
      });
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new BybitApiError({
        retCode: -1,
        retMsg: `Schema validation failed: ${parsed.error.message}`,
        class: "parse_error",
        cause: parsed.error,
      });
    }

    return parsed.data as TResult;
  }

  throw new BybitApiError({
    retCode: -1,
    retMsg: "Max retry attempts exceeded",
    class: "unknown",
  });
}
