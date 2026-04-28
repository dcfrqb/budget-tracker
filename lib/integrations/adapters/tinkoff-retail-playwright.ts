// WARNING: Reverse-engineering T-Bank's non-public web API likely violates their
// Terms of Service. Use only with explicit understanding of associated risks.

import { rm } from "node:fs/promises";
import type { BankAdapter, AdapterContext } from "@/lib/integrations/types";
import type { ImportRow } from "@/lib/import/types";
import { normalizeRuPhone } from "@/lib/format/phone";
import { listAccountLinks } from "@/lib/data/_queries/integrations";
import { withTbankBrowser, profileDirFor } from "@/lib/integrations/playwright/browser";
import { runFullLogin, runFastLogin } from "@/lib/integrations/playwright/auth-flow";
import type { TinkoffSessionAuth } from "@/lib/integrations/playwright/auth-flow";
import {
  waitForSms,
  cancelSms,
  pushSms,
} from "@/lib/integrations/playwright/sms-channel";
import {
  registerSession,
  abortSession,
} from "@/lib/integrations/playwright/session-registry";
import {
  parseTinkoffResponse,
  TinkoffApiError,
} from "./tinkoff-retail.parser";
import type {
  TinkoffPlaywrightSecrets,
  TinkoffOperation,
  TinkoffAccountSummary,
} from "./tinkoff-retail.types";

function classifyAdapterError(err: unknown): string {
  if (!(err instanceof Error)) return "unknown";
  const msg = err.message;
  // Known synthetic codes from auth-flow
  if (msg === "captcha_required") return "captcha_required";
  if (msg === "session_expired") return "session_expired";
  if (msg === "unknown_step") return "unknown_step";
  // State machine error codes
  if (msg === "lk_password_required") return "lk_password_required";
  if (msg === "push_confirmation_required") return "push_confirmation_required";
  if (msg === "too_many_transitions") return "too_many_transitions";
  if (msg === "sms_input_missing") return "sms_input_missing";
  if (msg === "pin_screen_missing") return "pin_screen_missing";
  if (msg === "mybank_redirect_missing") return "mybank_redirect_missing";
  if (msg === "invalid_otp") return "invalid_otp";
  if (msg === "invalid_password") return "invalid_password";
  if (msg === "too_many_attempts") return "too_many_attempts";
  // sms-channel reasons and Playwright TimeoutError
  if (msg === "timeout" || msg === "superseded" || err.name === "TimeoutError") return "sms_timeout";
  // no_session from browser storage state absence
  if (msg === "no_session") return "no_session";
  // Playwright network failures
  if (msg.includes("net::ERR_") || msg.includes("NetworkError")) return "network_error";
  // Playwright navigation timeouts (separate from sms_timeout — these are page-nav failures)
  if (msg.includes("Navigation timeout") || msg.includes("page.waitForURL")) return "navigation_timeout";
  // Browser-launch failures
  if (msg.includes("Failed to launch") || msg.includes("Executable doesn't exist")) return "browser_unavailable";
  // Storage state corruption (thrown by browser.ts)
  if (msg === "invalid storageState JSON") return "invalid_session";
  if (msg === "tinkoff_session_cookies_missing") return "tinkoff_session_cookies_missing";
  return "unknown";
}

const TINKOFF_API_BASE =
  "https://www.tbank.ru/api/common/v1";
const TINKOFF_COMMON_QUERY =
  "appName=supreme&appVersion=0.0.1&origin=web%2Cib5%2Cplatform";

function buildApiUrl(
  endpoint: string,
  sessionAuth: TinkoffSessionAuth,
  extra: Record<string, string | number> = {},
): string {
  const url = new URL(`${TINKOFF_API_BASE}/${endpoint}`);
  url.search = TINKOFF_COMMON_QUERY;
  url.searchParams.set("sessionid", sessionAuth.sessionid);
  url.searchParams.set("wuid", sessionAuth.wuid);
  for (const [k, v] of Object.entries(extra)) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

function readSecrets(ctx: AdapterContext): TinkoffPlaywrightSecrets {
  return ctx.secrets as TinkoffPlaywrightSecrets;
}

export const tinkoffRetailAdapter: BankAdapter = {
  id: "tinkoff-retail",
  displayName: "settings.integrations.adapter.tinkoff_retail",
  category: "api-reverse",
  supports: {
    login: true,
    otp: true,
    fetchTransactions: true,
    parseFile: false,
    listExternalAccounts: true,
  },

  async login(
    ctx: AdapterContext,
    input: { username: string; password: string; lkPassword?: string },
  ) {
    const phone = normalizeRuPhone(input.username);
    if (!phone) {
      await ctx.setStatus("ERROR", "invalid_phone");
      return { ok: false as const, error: "invalid_phone" };
    }

    const pin = input.password.trim();
    if (!/^\d{4}$/.test(pin)) {
      await ctx.setStatus("ERROR", "invalid_pin");
      return { ok: false as const, error: "invalid_pin" };
    }

    const lkPassword = input.lkPassword?.trim() ?? "";
    if (!lkPassword.length) {
      await ctx.setStatus("ERROR", "lk_password_required");
      return { ok: false as const, error: "lk_password_required" };
    }

    await ctx.saveSecrets({ phone, pin, password: lkPassword } satisfies Omit<
      TinkoffPlaywrightSecrets,
      "storageState" | "lastFastLoginAt" | "lastFullLoginAt"
    >);
    await ctx.setStatus("NEEDS_OTP");

    const credentialId = ctx.credentialId;

    let abortFn: () => void = () => {};

    // Holds a reference to the Playwright BrowserContext once it is created so
    // abortFn can close the browser immediately regardless of which await point
    // the task is currently blocked on. Using a ref object ensures abortFn
    // (defined synchronously after the IIFE starts) sees the captured context
    // even before the first await resolves.
    const browserCtxRef: { current: import("playwright").BrowserContext | null } = { current: null };

    const task = (async () => {
      try {
        const { storageState, sessionAuth } = await withTbankBrowser(
          { credentialId, storageState: null },
          async ({ context, page }) => {
            browserCtxRef.current = context;
            return runFullLogin({
              page,
              phone,
              pin,
              password: lkPassword,
              smsResolver: () => waitForSms(credentialId),
            });
          },
        );

        const freshSecrets: TinkoffPlaywrightSecrets = {
          phone,
          pin,
          password: lkPassword,
          storageState,
          sessionid: sessionAuth.sessionid,
          wuid: sessionAuth.wuid,
          lastFullLoginAt: Date.now(),
        };
        await ctx.saveSecrets(freshSecrets);
        await ctx.setStatus("CONNECTED");
      } catch (err) {
        cancelSms(credentialId, "login_failed");
        if (err instanceof Error) {
          const msg = err.message;
          const isPwTimeout = err.name === "TimeoutError";
          if (msg === "captcha_required") {
            await ctx.setStatus("ERROR", "captcha_required");
          } else if (msg === "timeout" || msg === "superseded" || isPwTimeout) {
            await ctx.setStatus("NEEDS_OTP", "sms_timeout");
          } else {
            await ctx.setStatus("ERROR", classifyAdapterError(err));
          }
        } else {
          await ctx.setStatus("ERROR", "unknown");
        }
      } finally {
        browserCtxRef.current = null;
      }
    })().catch((err: unknown) => {
      // Outer guard: catches any rejection that escapes the inner try/catch
      // (e.g. ctx.saveSecrets or ctx.setStatus throwing after a successful PIN
      // flow). Must not re-throw — its sole job is to prevent an unhandled
      // rejection from crashing the Node process.
      const code = classifyAdapterError(err);
      ctx.setStatus("ERROR", code).catch(() => {});
    });

    abortFn = () => {
      cancelSms(credentialId, "aborted");
      // Close the browser immediately so Chromium does not keep running while
      // waiting for an OTP that will never arrive.
      const ctx = browserCtxRef.current;
      if (ctx !== null) ctx.close().catch(() => {});
    };

    registerSession(credentialId, {
      promise: task,
      abort: abortFn,
      startedAt: Date.now(),
    });

    return { ok: true as const, needsOtp: true as const };
  },

  async submitOtp(ctx: AdapterContext, input: { code: string }) {
    const sent = pushSms(ctx.credentialId, input.code);
    if (!sent) {
      return { ok: false as const, error: "no_pending_sms" };
    }
    return { ok: true as const };
  },

  async fetchTransactions(
    ctx: AdapterContext,
    range: { from: Date; to: Date },
  ): Promise<ImportRow[]> {
    const secrets = readSecrets(ctx);

    if (!secrets.storageState) {
      await ctx.setStatus("NEEDS_OTP", "no_session");
      throw new Error("no_session");
    }

    const links = await listAccountLinks(ctx.credentialId);
    if (links.length === 0) {
      return [];
    }

    return withTbankBrowser(
      { credentialId: ctx.credentialId, storageState: secrets.storageState },
      async ({ page, saveStorageState }) => {
        let sessionAuth: TinkoffSessionAuth;
        try {
          ({ sessionAuth } = await runFastLogin({ page, pin: secrets.pin }));
        } catch (err) {
          if (err instanceof Error && err.message === "session_expired") {
            await ctx.setStatus("NEEDS_OTP", "session_expired");
            throw err;
          }
          if (err instanceof Error && err.message === "captcha_required") {
            await ctx.setStatus("ERROR", "captcha_required");
            throw err;
          }
          throw err;
        }

        const results: ImportRow[] = [];

        for (const link of links) {
          const url = buildApiUrl("operations", sessionAuth, {
            account: link.externalAccountId,
            start: range.from.getTime(),
            end: range.to.getTime(),
          });

          const response = await page.request.get(url);
          const json = await response.json();
          const { payload: ops } = parseTinkoffResponse<TinkoffOperation[]>(json);

          for (const op of ops) {
            const cardLast4Raw = op.cardNumber != null
              ? String(op.cardNumber).replace(/^\*+/, "").replace(/\D/g, "").slice(-4)
              : undefined;
            const cardLast4 =
              cardLast4Raw !== undefined && /^\d{4}$/.test(cardLast4Raw)
                ? cardLast4Raw
                : undefined;

            const row: ImportRow = {
              externalId: op.id,
              occurredAt: new Date(op.operationTime.milliseconds).toISOString(),
              amount: Math.abs(op.amount.value).toFixed(2),
              currencyCode: op.amount.currency.name,
              kind: op.type === "Credit" ? "INCOME" : "EXPENSE",
              direction: op.type === "Credit" ? "in" : "out",
              description: op.description,
              accountId: link.accountId,
              ...(cardLast4 !== undefined ? { cardLast4 } : {}),
              ...(op.spendingCategory?.name !== undefined
                ? { rawCategory: op.spendingCategory.name }
                : {}),
              raw: {
                tinkoffId: op.id,
                ...(op.mccString !== undefined ? { mccString: op.mccString } : {}),
                ...(op.cardNumber !== undefined
                  ? { cardNumber: op.cardNumber }
                  : {}),
                ...(op.spendingCategory?.name !== undefined
                  ? { rawCategory: op.spendingCategory.name }
                  : {}),
              },
            };
            results.push(row);
          }
        }

        const freshStorageState = await saveStorageState();
        await ctx.saveSecrets({
          ...secrets,
          storageState: freshStorageState,
          sessionid: sessionAuth.sessionid,
          wuid: sessionAuth.wuid,
          lastFastLoginAt: Date.now(),
        } satisfies TinkoffPlaywrightSecrets);

        return results;
      },
    );
  },

  async listExternalAccounts(ctx: AdapterContext) {
    const secrets = readSecrets(ctx);

    if (!secrets.storageState) {
      await ctx.setStatus("NEEDS_OTP", "no_session");
      throw new Error("no_session");
    }

    return withTbankBrowser(
      { credentialId: ctx.credentialId, storageState: secrets.storageState },
      async ({ page, saveStorageState }) => {
        let sessionAuth: TinkoffSessionAuth;
        try {
          ({ sessionAuth } = await runFastLogin({ page, pin: secrets.pin }));
        } catch (err) {
          if (err instanceof Error && err.message === "session_expired") {
            await ctx.setStatus("NEEDS_OTP", "session_expired");
            throw err;
          }
          if (err instanceof Error && err.message === "captcha_required") {
            await ctx.setStatus("ERROR", "captcha_required");
            throw err;
          }
          throw err;
        }

        const url = buildApiUrl("accounts_light_ib", sessionAuth);
        const response = await page.request.get(url);
        const json = await response.json();
        const { payload: accounts } =
          parseTinkoffResponse<TinkoffAccountSummary[]>(json);

        const result = accounts.map((acct) => ({
          externalAccountId: acct.id,
          label: `${acct.name} (${acct.currency.name})`,
          currencyCode: acct.currency.name,
          accountType: acct.accountType,
        }));

        const freshStorageState = await saveStorageState();
        await ctx.saveSecrets({
          ...secrets,
          storageState: freshStorageState,
          sessionid: sessionAuth.sessionid,
          wuid: sessionAuth.wuid,
          lastFastLoginAt: Date.now(),
        } satisfies TinkoffPlaywrightSecrets);

        return result;
      },
    );
  },

  async refreshSession(ctx: AdapterContext) {
    const secrets = readSecrets(ctx);

    if (!secrets.storageState) {
      return;
    }

    try {
      await withTbankBrowser(
        { credentialId: ctx.credentialId, storageState: secrets.storageState },
        async ({ page, saveStorageState }) => {
          const { sessionAuth } = await runFastLogin({ page, pin: secrets.pin });
          const freshStorageState = await saveStorageState();
          await ctx.saveSecrets({
            ...secrets,
            storageState: freshStorageState,
            sessionid: sessionAuth.sessionid,
            wuid: sessionAuth.wuid,
            lastFastLoginAt: Date.now(),
          } satisfies TinkoffPlaywrightSecrets);
        },
      );
    } catch (err) {
      if (err instanceof Error && err.message === "session_expired") {
        await ctx.setStatus("NEEDS_OTP", "session_expired");
        return;
      }
      await ctx.setStatus("ERROR", classifyAdapterError(err));
    }
  },

  async disconnect(ctx: AdapterContext) {
    abortSession(ctx.credentialId, "disconnect");
    cancelSms(ctx.credentialId, "disconnect");

    try {
      await rm(profileDirFor(ctx.credentialId), { recursive: true, force: true });
    } catch {
      // best-effort
    }

    await ctx.saveSecrets({});
    await ctx.setStatus("DISCONNECTED");
  },
};
