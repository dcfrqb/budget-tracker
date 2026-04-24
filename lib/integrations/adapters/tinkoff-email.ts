/**
 * Tinkoff Email-Forward adapter — STUB.
 *
 * Full implementation requires a separate long-running IMAP idle listener process.
 * See: code/docs/integrations/email-listener.md
 *
 * Current behaviour:
 * - login: stores the forwarding email address in secrets.
 * - fetchTransactions: returns [] with an ERROR status and an explanatory message.
 */

import type { BankAdapter, AdapterContext } from "@/lib/integrations/types";
import type { ImportRow } from "@/lib/import/types";

export const tinkoffEmailAdapter: BankAdapter = {
  id: "tinkoff-email",
  displayName: "settings.integrations.adapter.tinkoff_email",
  category: "email-forward",
  supports: {
    login: true,
    otp: false,
    fetchTransactions: true,
    parseFile: false,
  },

  async login(
    ctx: AdapterContext,
    input: { username: string; password: string },
  ) {
    // For email-forward, "username" is the forwarding email address.
    // "password" is unused but kept for interface compatibility.
    const forwardingEmail = input.username.trim();
    if (!forwardingEmail.includes("@")) {
      return {
        ok: false as const,
        error: "Please enter a valid email address for forwarding.",
      };
    }

    await ctx.saveSecrets({ forwardingEmail });
    await ctx.setStatus("CONNECTED");
    return { ok: true as const };
  },

  async fetchTransactions(
    ctx: AdapterContext,
    _range: { from: Date; to: Date },
  ): Promise<ImportRow[]> {
    // IMAP listener is not running — cannot fetch transactions automatically.
    await ctx.setStatus(
      "ERROR",
      "IMAP-listener not running. See docs/integrations/email-listener.md for setup instructions.",
    );
    return [];
  },

  async disconnect(ctx: AdapterContext) {
    await ctx.saveSecrets({});
    await ctx.setStatus("DISCONNECTED");
  },
};
