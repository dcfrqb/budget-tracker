// WARNING: Reverse-engineering T-Bank's non-public web API likely violates their
// Terms of Service. Use only with explicit understanding of associated risks.

import { rm } from "node:fs/promises";
import path from "node:path";
import type { BankAdapter, AdapterContext } from "@/lib/integrations/types";
import type { ImportRow } from "@/lib/import/types";
import { normalizeRuPhone } from "@/lib/format/phone";
import { listAccountLinks } from "@/lib/data/_queries/integrations";
import { withTbankBrowser } from "@/lib/integrations/playwright/browser";
import { runFullLogin, runFastLogin } from "@/lib/integrations/playwright/auth-flow";
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

const TINKOFF_API_BASE =
  "https://www.tbank.ru/api/common/v1";
const TINKOFF_COMMON_QUERY =
  "appName=supreme&appVersion=0.0.1&origin=web%2Cib5%2Cplatform";

function buildApiUrl(
  endpoint: string,
  extra: Record<string, string | number> = {},
): string {
  const url = new URL(`${TINKOFF_API_BASE}/${endpoint}`);
  url.search = TINKOFF_COMMON_QUERY;
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
    input: { username: string; password: string },
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

    await ctx.saveSecrets({ phone, pin } satisfies Omit<
      TinkoffPlaywrightSecrets,
      "storageState" | "lastFastLoginAt" | "lastFullLoginAt"
    >);
    await ctx.setStatus("NEEDS_OTP");

    const credentialId = ctx.credentialId;

    let abortFn: () => void = () => {};

    const task = (async () => {
      try {
        const storageState = await withTbankBrowser(
          { credentialId, storageState: null },
          async ({ page }) => {
            const { storageState } = await runFullLogin({
              page,
              phone,
              pin,
              smsResolver: () => waitForSms(credentialId),
            });
            return storageState;
          },
        );

        const freshSecrets: TinkoffPlaywrightSecrets = {
          phone,
          pin,
          storageState,
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
            await ctx.setStatus("ERROR", msg.slice(0, 250));
          }
        } else {
          await ctx.setStatus("ERROR", "UNKNOWN");
        }
      }
    })();

    abortFn = () => {
      cancelSms(credentialId, "aborted");
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
        try {
          await runFastLogin({ page, pin: secrets.pin });
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
          const url = buildApiUrl("operations", {
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
        try {
          await runFastLogin({ page, pin: secrets.pin });
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

        const url = buildApiUrl("accounts_light_ib");
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
          await runFastLogin({ page, pin: secrets.pin });
          const freshStorageState = await saveStorageState();
          await ctx.saveSecrets({
            ...secrets,
            storageState: freshStorageState,
            lastFastLoginAt: Date.now(),
          } satisfies TinkoffPlaywrightSecrets);
        },
      );
    } catch (err) {
      if (err instanceof Error && err.message === "session_expired") {
        await ctx.setStatus("NEEDS_OTP", "session_expired");
        return;
      }
      const msg =
        err instanceof Error ? err.message.slice(0, 250) : "UNKNOWN";
      await ctx.setStatus("ERROR", msg);
    }
  },

  async disconnect(ctx: AdapterContext) {
    abortSession(ctx.credentialId, "disconnect");
    cancelSms(ctx.credentialId, "disconnect");

    const baseDir =
      process.env.PLAYWRIGHT_PROFILES_DIR ??
      "/var/lib/budget-tracker/playwright-profiles";
    const profileDir = path.join(baseDir, ctx.credentialId);

    try {
      await rm(profileDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }

    await ctx.saveSecrets({});
    await ctx.setStatus("DISCONNECTED");
  },
};
