"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/api/auth";
import { toSafeError } from "@/lib/integrations/safe-error";
import {
  connectAdapter,
  loginWithCredential,
  submitOtpForCredential,
  syncCredential,
  disconnectCredential,
  deleteCredential,
  linkExternalAccount,
  unlinkExternalAccount,
  listAccountLinksForCredential,
  listExternalAccountsForCredential,
  reloginCredential,
  createAccountAndLink,
} from "@/lib/data/_mutations/integrations";
import { listAccountsForQuickDrawer } from "@/lib/data/wallet";
import {
  connectInputSchema,
  loginInputSchema,
  submitOtpSchema,
  disconnectInputSchema,
  deleteCredentialSchema,
  linkExternalAccountSchema,
  unlinkExternalAccountSchema,
  reloginSchema,
  createAccountAndLinkSchema,
  toValidationFailure,
} from "@/lib/validation/integrations";

// ─────────────────────────────────────────────────────────────
// Server actions for integration credential management.
// All are guarded by assertAdminIntegrations inside each mutation.
// All inputs are validated via Zod before reaching business logic.
// ─────────────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string; issues?: string[] };

/** Connect a new adapter (creates credential record). */
export async function connectAdapterAction(
  adapterId: string,
  input: Record<string, string>,
): Promise<ActionResult> {
  // Validate: adapterId + adapter-specific fields
  const parsed = connectInputSchema.safeParse({ adapterId, ...input });
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const { displayLabel, adapterId: _id, ...rest } = parsed.data as Record<string, unknown>;

    // For login-flow adapters (supports.login === true), the password/phone supplied
    // at connect time is consumed by adapter.login() — never persisted in secrets.
    // Strip all credential-like fields so the initial encrypted blob is clean.
    // CSV adapters (no login) keep their config fields (e.g. forwarding email).
    const { getAdapter } = await import("@/lib/integrations/registry");
    const adapter = getAdapter(String(parsed.data.adapterId));
    const CREDENTIAL_FIELDS = ["password", "username", "phone", "code", "lkPassword"];
    const initialSecrets: Record<string, unknown> =
      adapter?.supports.login
        ? Object.fromEntries(
            Object.entries(rest).filter(([k]) => !CREDENTIAL_FIELDS.includes(k)),
          )
        : rest;

    const credential = await connectAdapter(
      userId,
      String(parsed.data.adapterId),
      initialSecrets,
      typeof displayLabel === "string" ? displayLabel : undefined,
    );
    revalidatePath("/settings/integrations");
    return { ok: true, data: { id: credential.id } };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Trigger login flow (username + password). */
export async function loginAction(
  credentialId: string,
  input: { username: string; password: string; lkPassword?: string },
): Promise<ActionResult> {
  // Validate: credentialId format + password presence
  const parsed = loginInputSchema.safeParse({ credentialId, password: input.password });
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await loginWithCredential(userId, credentialId, input);
    revalidatePath("/settings/integrations");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Submit OTP code. */
export async function submitOtpAction(
  credentialId: string,
  input: { code: string },
): Promise<ActionResult> {
  const parsed = submitOtpSchema.safeParse({ credentialId, code: input.code });
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await submitOtpForCredential(userId, parsed.data.credentialId, {
      code: parsed.data.code,
    });
    revalidatePath("/settings/integrations");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Trigger sync (fetchTransactions + create). */
export async function syncAction(credentialId: string): Promise<ActionResult> {
  // credentialId comes from server-rendered UI — validate format.
  const parsed = disconnectInputSchema.safeParse({ credentialId });
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await syncCredential(userId, parsed.data.credentialId);
    revalidatePath("/settings/integrations");
    revalidatePath("/transactions");
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Disconnect (clear secrets, DISCONNECTED status). */
export async function disconnectAction(
  credentialId: string,
): Promise<ActionResult> {
  const parsed = disconnectInputSchema.safeParse({ credentialId });
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    await disconnectCredential(userId, parsed.data.credentialId);
    revalidatePath("/settings/integrations");
    return { ok: true };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Hard delete credential. */
export async function deleteCredentialAction(
  credentialId: string,
): Promise<ActionResult> {
  const parsed = deleteCredentialSchema.safeParse({ credentialId });
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    await deleteCredential(userId, parsed.data.credentialId);
    revalidatePath("/settings/integrations");
    return { ok: true };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Link (or re-link) an external bank account to a local account. */
export async function linkExternalAccountAction(input: {
  credentialId: string;
  externalAccountId: string;
  accountId: string;
  label?: string;
}): Promise<ActionResult> {
  const parsed = linkExternalAccountSchema.safeParse(input);
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await linkExternalAccount(
      userId,
      parsed.data.credentialId,
      parsed.data.externalAccountId,
      parsed.data.accountId,
      parsed.data.label,
    );
    revalidatePath("/settings/integrations");
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Remove the link between an external account id and a local account. */
export async function unlinkExternalAccountAction(input: {
  credentialId: string;
  externalAccountId: string;
}): Promise<ActionResult> {
  const parsed = unlinkExternalAccountSchema.safeParse(input);
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await unlinkExternalAccount(
      userId,
      parsed.data.credentialId,
      parsed.data.externalAccountId,
    );
    revalidatePath("/settings/integrations");
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** List all account links for a credential with joined account details (read-only). */
export async function listAccountLinksAction(
  credentialId: string,
): Promise<ActionResult> {
  const parsed = deleteCredentialSchema.safeParse({ credentialId });
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await listAccountLinksForCredential(userId, parsed.data.credentialId);
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Enumerate external bank accounts via the adapter API (read-only — live HTTP call). */
export async function listExternalAccountsAction(
  credentialId: string,
): Promise<ActionResult> {
  const parsed = deleteCredentialSchema.safeParse({ credentialId });
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await listExternalAccountsForCredential(userId, parsed.data.credentialId);
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** List user's non-archived accounts for linking dropdowns. */
export async function listUserAccountsAction(): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const result = await listAccountsForQuickDrawer(userId);
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/**
 * Create a new Account from external metadata and atomically link it to the
 * credential's external account. One-click alternative to the two-step
 * "create account first, then pick it in the dropdown" flow.
 */
export async function createAccountAndLinkAction(input: {
  credentialId: string;
  externalAccountId: string;
  label: string;
  currencyCode: string;
  accountType: string;
}): Promise<ActionResult> {
  const parsed = createAccountAndLinkSchema.safeParse(input);
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await createAccountAndLink(userId, parsed.data);
    revalidatePath("/settings/integrations");
    revalidatePath("/wallet");
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Re-run the login flow for an existing credential (e.g. after session expiry). */
export async function reloginAction(input: {
  credentialId: string;
  phone: string;
  lkPassword: string;
  password: string;
}): Promise<ActionResult> {
  const parsed = reloginSchema.safeParse(input);
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await reloginCredential(userId, parsed.data.credentialId, {
      phone: parsed.data.phone,
      lkPassword: parsed.data.lkPassword,
      password: parsed.data.password,
    });
    revalidatePath("/settings/integrations");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}
