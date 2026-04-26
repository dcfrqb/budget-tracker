/// STUB-implementation. Requires reverse-engineering of Tinkoff mobile API endpoints.
/// Methods login/submitOtp demonstrate the full auth flow with dev-mode dummy data.
/// fetchTransactions returns [] until real endpoints are mapped.
///
/// To implement for real:
///   1. Capture Tinkoff mobile app traffic (mitmproxy / Charles).
///   2. Document the auth flow: POST /v1/session → POST /v1/confirm/phone → Bearer token.
///   3. Document the transactions endpoint: GET /v1/operations?from=...&to=...
///   4. Replace stub methods below with real HTTP calls.
///   5. Handle token refresh via refreshSession().
///
/// WARNING: Reverse-engineering Tinkoff's non-public mobile API likely violates their
/// Terms of Service. Use only with explicit understanding of associated risks.

// SECURITY: all outbound HTTP MUST go through `httpFetch` from "@/lib/integrations/http"
// to enforce HTTPS, realistic User-Agent, and timeout.
// Do NOT call fetch() directly in this file.

import type { BankAdapter, AdapterContext } from "@/lib/integrations/types";
import type { ImportRow } from "@/lib/import/types";

const STUB_OTP_SUCCESS = "000000"; // dev-mode only: any real OTP will be different

export const tinkoffRetailAdapter: BankAdapter = {
  id: "tinkoff-retail",
  displayName: "settings.integrations.adapter.tinkoff_retail",
  category: "api-reverse",
  supports: {
    login: true,
    otp: true,
    fetchTransactions: true,
    parseFile: false,
  },

  async login(
    ctx: AdapterContext,
    input: { username: string; password: string },
  ) {
    const phone = input.username.trim();
    const password = input.password.trim();

    // Basic validation — Tinkoff uses Russian phone numbers (+7XXXXXXXXXX)
    if (!phone) {
      return { ok: false as const, error: "Phone number is required." };
    }
    if (!password) {
      return { ok: false as const, error: "Password is required." };
    }

    // STUB: In a real implementation this would POST to Tinkoff's auth endpoint,
    // receive a session token, and trigger an SMS OTP.
    await ctx.saveSecrets({
      step: "awaiting_otp",
      session: "stub-session-" + Date.now(),
      phone,
    });
    await ctx.setStatus("NEEDS_OTP");

    return { ok: true as const, needsOtp: true as const };
  },

  async submitOtp(ctx: AdapterContext, input: { code: string }) {
    const code = input.code.trim();

    if (ctx.secrets["step"] !== "awaiting_otp") {
      return {
        ok: false as const,
        error: "No pending OTP session. Please login first.",
      };
    }

    // STUB: In production this would POST the OTP code to Tinkoff's confirm endpoint.
    // Dev convenience: "000000" always succeeds.
    if (code !== STUB_OTP_SUCCESS) {
      return {
        ok: false as const,
        error: `Invalid OTP code. (Dev stub: use "${STUB_OTP_SUCCESS}" to succeed.)`,
      };
    }

    await ctx.saveSecrets({
      ...ctx.secrets,
      step: "ready",
      accessToken: "stub-access-token-" + Date.now(),
    });
    await ctx.setStatus("CONNECTED");

    return { ok: true as const };
  },

  async fetchTransactions(
    ctx: AdapterContext,
    _range: { from: Date; to: Date },
  ): Promise<ImportRow[]> {
    // STUB: Retail reverse-engineering not implemented.
    // Returning empty array with warning status.
    await ctx.setStatus(
      "ERROR",
      "Retail reverse-engineering not implemented. Tinkoff mobile API endpoints must be mapped first. See lib/integrations/adapters/tinkoff-retail.ts for instructions.",
    );
    return [];
  },

  async refreshSession(ctx: AdapterContext) {
    // STUB: Would refresh the OAuth/session token.
    // For now, mark as needing re-auth if token is stale.
    if (ctx.secrets["step"] !== "ready") {
      await ctx.setStatus(
        "DISCONNECTED",
        "Session expired. Please login again.",
      );
    }
  },

  async disconnect(ctx: AdapterContext) {
    await ctx.saveSecrets({});
    await ctx.setStatus("DISCONNECTED");
  },
};
