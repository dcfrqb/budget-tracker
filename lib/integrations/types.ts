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

export type AdapterScheduling = {
  autosyncEnabled: boolean;
  defaultIntervalMs: number;
  minIntervalMs: number;
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
  scheduling: AdapterScheduling;
};

export function toAdapterMeta(a: BankAdapter): BankAdapterMeta {
  return {
    id: a.id,
    displayName: a.displayName,
    category: a.category,
    supports: a.supports,
    scheduling: a.scheduling,
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
  scheduling: AdapterScheduling;
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
      /** Last-4-digit strings from all cards linked to this account. */
      cardLast4?: string[];
      /** Credit limit, Decimal-as-string (credit accounts only). */
      creditLimit?: string;
      /** Current debt balance, Decimal-as-string (credit accounts only). */
      debtBalance?: string;
      /** Current minimal payment amount, Decimal-as-string (credit accounts only). */
      currentMinimalPayment?: string;
      /** Bank requisites (INN, KPP, correspondent account, BIC, bank name, recipient). */
      requisites?: {
        inn?: string;
        kpp?: string;
        correspondentAccount?: string;
        bic?: string;
        bankName?: string;
        recipientName?: string;
      };
      /** Day of month (1..31) when minimal payment is due; derived from paymentDueDate if present. */
      paymentDueDay?: number;
    }>
  >;
  runSync?: (
    ctx: AdapterContext,
    range: { from: Date; to: Date },
  ) => Promise<{
    externals: Awaited<ReturnType<NonNullable<BankAdapter["listExternalAccounts"]>>>;
    rows: ImportRow[];
    cardLast4ByExternal: Map<string, string[]>;
  }>;
  refreshSession?: (ctx: AdapterContext) => Promise<void>;
  disconnect?: (ctx: AdapterContext) => Promise<void>;
};
