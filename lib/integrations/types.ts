import type { IntegrationStatus } from "@prisma/client";
import type { ImportRow } from "@/lib/import/types";

export type { IntegrationStatus };

export type AdapterAuthStage = "idle" | "awaiting_otp" | "ready" | "error";

export type AdapterContext = {
  credentialId: string;
  userId: string;
  secrets: Record<string, unknown>; // decrypted
  saveSecrets: (next: Record<string, unknown>) => Promise<void>;
  setStatus: (status: IntegrationStatus, err?: string) => Promise<void>;
};

export type BankAdapterMeta = {
  id: string;
  displayName: string;
  category: "csv" | "email-forward" | "api-reverse";
  supports: {
    login: boolean;
    otp: boolean;
    fetchTransactions: boolean;
    parseFile: boolean;
    listExternalAccounts: boolean;
  };
};

export function toAdapterMeta(a: BankAdapter): BankAdapterMeta {
  return {
    id: a.id,
    displayName: a.displayName,
    category: a.category,
    supports: a.supports,
  };
}

export type BankAdapter = {
  id: string; // "tinkoff-retail" | "tinkoff-email" | "tinkoff-csv" | "sber-csv" | "generic-csv"
  displayName: string; // i18n key or literal
  category: "csv" | "email-forward" | "api-reverse";
  supports: {
    login: boolean; // requires username/password
    otp: boolean; // SMS/PIN second factor
    fetchTransactions: boolean; // can pull data automatically
    parseFile: boolean; // accepts exported file
    listExternalAccounts: boolean; // can enumerate bank accounts via API
  };
  login?: (
    ctx: AdapterContext,
    input: { username: string; password: string; lkPassword?: string },
  ) => Promise<
    | { ok: true }
    | { ok: true; needsOtp: true }
    | { ok: false; error: string }
  >;
  submitOtp?: (
    ctx: AdapterContext,
    input: { code: string },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  fetchTransactions?: (
    ctx: AdapterContext,
    range: { from: Date; to: Date },
  ) => Promise<ImportRow[]>;
  parseFile?: (input: ArrayBuffer | string) => Promise<ImportRow[]>;
  listExternalAccounts?: (
    ctx: AdapterContext,
  ) => Promise<
    Array<{
      externalAccountId: string;
      label: string;
      currencyCode: string;
      accountType?: string;
      /** Decimal-as-string snapshot of the account balance at fetch time. */
      balance?: string;
    }>
  >;
  refreshSession?: (ctx: AdapterContext) => Promise<void>;
  disconnect?: (ctx: AdapterContext) => Promise<void>;
};
