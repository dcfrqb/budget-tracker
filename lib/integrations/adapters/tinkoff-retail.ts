// SECURITY: all outbound HTTP MUST go through `httpFetch` from "@/lib/integrations/http"
// to enforce HTTPS, realistic User-Agent, and timeout.
// Do NOT call fetch() directly in this file.

// WARNING: Reverse-engineering T-Bank's non-public web API likely violates their
// Terms of Service. Use only with explicit understanding of associated risks.

import type { BankAdapter, AdapterContext } from "@/lib/integrations/types";
import type { ImportRow } from "@/lib/import/types";
import {
  TinkoffApiError,
  parseTinkoffResponse,
  tinkoffPost,
  tinkoffGet,
  generateWuid,
} from "./tinkoff-retail.client";
import type {
  TinkoffSecrets,
  TinkoffOperation,
  TinkoffAccountSummary,
} from "./tinkoff-retail.types";
import { normalizeRuPhone } from "@/lib/format/phone";
import { listAccountLinks } from "@/lib/data/_queries/integrations";

function readSecrets(ctx: AdapterContext): TinkoffSecrets {
  return ctx.secrets as TinkoffSecrets;
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

    const secrets = readSecrets(ctx);

    try {
      // Step 1: obtain sessionid if we don't have one
      let sessionid = typeof secrets.sessionid === "string" ? secrets.sessionid : undefined;
      const wuid = typeof secrets.wuid === "string" ? secrets.wuid : generateWuid();

      if (!sessionid) {
        const sessionJson = await tinkoffPost("session", undefined, undefined, {});
        const { payload: sessionPayload } = parseTinkoffResponse<{ sessionid: string }>(sessionJson);
        sessionid = sessionPayload.sessionid;
      }

      // Step 2: sign_up — inspect raw JSON directly so we can extract the ticket
      // without re-issuing the request.  parseTinkoffResponse would throw on
      // WAITING_CONFIRMATION (non-OK), so we read the envelope ourselves.
      const signUpJson = await tinkoffPost("sign_up", sessionid, wuid, {
        phone,
        password: input.password,
      });
      const signUpObj = signUpJson as Record<string, unknown>;
      const signUpCode =
        typeof signUpObj.resultCode === "string" ? signUpObj.resultCode : "";

      if (signUpCode !== "WAITING_CONFIRMATION") {
        // Unexpected: if T-Bank returned OK or another code, surface it
        try {
          parseTinkoffResponse(signUpJson); // will throw for non-OK, including OK (won't throw)
        } catch (parseErr) {
          throw parseErr;
        }
        throw new TinkoffApiError(
          "UNKNOWN",
          `sign_up returned unexpected resultCode: ${signUpCode}`,
        );
      }

      const signUpPayload = signUpObj.payload as Record<string, unknown> | undefined;
      const ticketDirect =
        signUpPayload && typeof signUpPayload.ticket === "string"
          ? signUpPayload.ticket
          : undefined;
      const ticketNested =
        signUpPayload &&
        Array.isArray(signUpPayload.confirmations) &&
        signUpPayload.confirmations.length > 0 &&
        typeof (signUpPayload.confirmations[0] as Record<string, unknown>)?.confirmationData === "object" &&
        (signUpPayload.confirmations[0] as Record<string, unknown>).confirmationData !== null
          ? (
              (signUpPayload.confirmations[0] as Record<string, unknown>)
                .confirmationData as Record<string, unknown>
            ).value
          : undefined;

      const ticket = ticketDirect ?? ticketNested;
      if (typeof ticket !== "string") {
        throw new TinkoffApiError(
          "UNKNOWN",
          "sign_up WAITING_CONFIRMATION: cannot locate ticket in payload — field-set drift",
        );
      }

      await ctx.saveSecrets({
        sessionid,
        wuid,
        phone,
        pendingTicket: ticket,
        step: "awaiting_otp",
      } satisfies TinkoffSecrets);
      await ctx.setStatus("NEEDS_OTP");
      return { ok: true as const, needsOtp: true as const };
    } catch (err) {
      if (err instanceof TinkoffApiError) {
        await ctx.setStatus("ERROR", `tinkoff:${err.code}`);
        return { ok: false as const, error: err.code };
      }
      await ctx.setStatus("ERROR", "UNKNOWN");
      return { ok: false as const, error: "UNKNOWN" };
    }
  },

  async submitOtp(ctx: AdapterContext, input: { code: string }) {
    const secrets = readSecrets(ctx);
    const { sessionid, wuid, pendingTicket } = secrets;

    if (!sessionid || !wuid || !pendingTicket) {
      return { ok: false as const, error: "no_pending_login" };
    }

    try {
      // Step 3: confirm OTP
      const confirmJson = await tinkoffPost("confirm", sessionid, wuid, {
        confirmationCode: input.code,
        ticket: pendingTicket,
      });
      parseTinkoffResponse(confirmJson);

      // Step 4: level_up
      const levelUpJson = await tinkoffPost("level_up", sessionid, wuid, {});
      parseTinkoffResponse(levelUpJson);

      await ctx.saveSecrets({
        sessionid,
        wuid,
        phone: secrets.phone,
        step: "ready",
        lastLevelUpAt: Date.now(),
      } satisfies TinkoffSecrets);
      await ctx.setStatus("CONNECTED");
      return { ok: true as const };
    } catch (err) {
      if (err instanceof TinkoffApiError) {
        await ctx.setStatus("ERROR", `tinkoff:${err.code}`);
        return { ok: false as const, error: err.code };
      }
      await ctx.setStatus("ERROR", "UNKNOWN");
      return { ok: false as const, error: "UNKNOWN" };
    }
  },

  async listExternalAccounts(ctx: AdapterContext) {
    const secrets = readSecrets(ctx);
    const { sessionid, wuid } = secrets;

    if (!sessionid || !wuid) {
      throw new TinkoffApiError("UNKNOWN", "No session — login required");
    }

    try {
      const json = await tinkoffGet("accounts_flat", sessionid, wuid);
      const { payload } = parseTinkoffResponse<TinkoffAccountSummary[]>(json);

      return payload.map((acct) => ({
        externalAccountId: acct.id,
        label: `${acct.name} (${acct.currency.name})`,
        currencyCode: acct.currency.name,
        accountType: acct.accountType,
      }));
    } catch (err) {
      if (err instanceof TinkoffApiError && err.code === "INSUFFICIENT_PRIVILEGES") {
        await ctx.setStatus("NEEDS_OTP");
      }
      throw err;
    }
  },

  async fetchTransactions(
    ctx: AdapterContext,
    range: { from: Date; to: Date },
  ): Promise<ImportRow[]> {
    const secrets = readSecrets(ctx);
    const { sessionid, wuid } = secrets;

    if (!sessionid || !wuid) {
      throw new TinkoffApiError("UNKNOWN", "No session — login required");
    }

    const links = await listAccountLinks(ctx.credentialId);

    if (links.length === 0) {
      return [];
    }

    const results: ImportRow[] = [];
    const errors: { externalAccountId: string; err: TinkoffApiError }[] = [];

    for (const link of links) {
      try {
        const json = await tinkoffGet("operations", sessionid, wuid, {
          account: link.externalAccountId,
          start: range.from.getTime(),
          end: range.to.getTime(),
        });

        const { payload: ops } = parseTinkoffResponse<TinkoffOperation[]>(json);

        for (const op of ops) {
          const row: ImportRow = {
            externalId: op.id,
            occurredAt: new Date(op.operationTime.milliseconds).toISOString(),
            amount: op.amount.value.toString(),
            currencyCode: op.amount.currency.name,
            kind: op.type === "Credit" ? "INCOME" : "EXPENSE",
            direction: op.type === "Credit" ? "in" : "out",
            description: op.description,
            accountId: link.accountId,
            raw: {
              tinkoffId: op.id,
              ...(op.mccString !== undefined ? { mccString: op.mccString } : {}),
              ...(op.cardNumber !== undefined ? { cardNumber: op.cardNumber } : {}),
              ...(op.spendingCategory?.name !== undefined
                ? { rawCategory: op.spendingCategory.name }
                : {}),
            },
          };
          results.push(row);
        }
      } catch (err) {
        if (err instanceof TinkoffApiError) {
          if (err.code === "INSUFFICIENT_PRIVILEGES") {
            await ctx.setStatus("NEEDS_OTP");
            throw err;
          }
          errors.push({ externalAccountId: link.externalAccountId, err });
        } else {
          throw err;
        }
      }
    }

    if (errors.length > 0 && results.length === 0) {
      // All accounts failed — surface the first error
      throw errors[0].err;
    }

    // Partial success (some accounts failed, some succeeded) — return what we have
    return results;
  },

  async refreshSession(ctx: AdapterContext) {
    const secrets = readSecrets(ctx);
    const { sessionid, wuid } = secrets;

    if (!sessionid || !wuid) {
      await ctx.setStatus("ERROR", "no_session");
      return;
    }

    try {
      const json = await tinkoffGet("ping", sessionid, wuid);
      parseTinkoffResponse(json);
    } catch (err) {
      const message =
        err instanceof TinkoffApiError ? `tinkoff:${err.code}` : "UNKNOWN";
      await ctx.setStatus("ERROR", message);
      // Do not wipe secrets — keep phone/sessionid for retry
    }
  },

  async disconnect(ctx: AdapterContext) {
    const secrets = readSecrets(ctx);
    const { sessionid, wuid } = secrets;

    // Best-effort remote sign-out
    if (sessionid && wuid) {
      try {
        const json = await tinkoffPost("sign_out", sessionid, wuid, {});
        parseTinkoffResponse(json);
      } catch {
        // Intentionally swallowed — disconnect must not fail on remote error
      }
    }

    await ctx.saveSecrets({});
    await ctx.setStatus("DISCONNECTED");
  },
};
