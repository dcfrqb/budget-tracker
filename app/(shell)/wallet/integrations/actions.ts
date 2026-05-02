"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/api/auth";
import { toSafeError } from "@/lib/integrations/safe-error";
import {
  connectAdapter,
  loginWithCredential,
  submitOtpForCredential,
  disconnectCredential,
  deleteCredential,
  linkExternalAccount,
  unlinkExternalAccount,
  listAccountLinksForCredential,
  listExternalAccountsForCredential,
  reloginCredential,
  createAccountAndLink,
  setScheduleInterval,
} from "@/lib/data/_mutations/integrations";
import { triggerManualSync, enqueueManualSync, enqueueSyncAll } from "@/lib/integrations/scheduler";
import { getSyncStatus } from "@/lib/data/sync-status";
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
  setScheduleIntervalSchema,
  syncStatusInput,
  toValidationFailure,
} from "@/lib/validation/integrations";
import type { SyncStatusItem } from "@/lib/data/sync-status";

// ─────────────────────────────────────────────────────────────
// Server actions for integration credential management.
// All are guarded by assertAdminIntegrations inside each mutation.
// All inputs are validated via Zod before reaching business logic.
// ─────────────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string; issues?: string[] };

export type SyncResult =
  | { ok: true; data: { created: number; updated: number; skipped: number; errorClass: string | null; syncLogId?: string } }
  | { ok: false; error: string };

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
    revalidatePath("/wallet/integrations");
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
    revalidatePath("/wallet/integrations");
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
    revalidatePath("/wallet/integrations");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Trigger sync for a single credential (non-blocking — returns jobId immediately). */
export async function syncAction(credentialId: string): Promise<{ ok: true; data: { jobId: string } } | { ok: false; error: string }> {
  const parsed = disconnectInputSchema.safeParse({ credentialId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_error" };

  try {
    const userId = await getCurrentUserId();
    const result = await enqueueManualSync(userId, parsed.data.credentialId);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: { jobId: result.jobId } };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Trigger sync for all connected credentials (non-blocking). */
export async function syncAllAction(): Promise<{ ok: true; data: { jobIds: string[]; skipped: Array<{ credentialId: string; reason: string }> } } | { ok: false; error: string }> {
  try {
    const userId = await getCurrentUserId();
    const result = await enqueueSyncAll(userId);
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/** Poll sync status for a list of credential IDs. */
export async function syncStatusAction(
  input: { credentialIds: string[] },
): Promise<{ ok: true; data: SyncStatusItem[] } | { ok: false; error: string }> {
  const parsed = syncStatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_error" };

  try {
    const userId = await getCurrentUserId();
    const data = await getSyncStatus(userId, parsed.data.credentialIds);
    return { ok: true, data };
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
    revalidatePath("/wallet/integrations");
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
    revalidatePath("/wallet/integrations");
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
    revalidatePath("/wallet/integrations");
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
    revalidatePath("/wallet/integrations");
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
  balance?: string;
}): Promise<ActionResult> {
  const parsed = createAccountAndLinkSchema.safeParse(input);
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await createAccountAndLink(userId, parsed.data);
    revalidatePath("/wallet/integrations");
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
    revalidatePath("/wallet/integrations");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: result };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}

/**
 * Update autosync cadence for a credential.
 * @deprecated Global autosync cadence is now in BudgetSettings.autosyncIntervalMs.
 * This export is kept for backward compatibility; do not call from new UI.
 */
export async function setScheduleIntervalAction(input: {
  credentialId: string;
  intervalMs: number | null;
}): Promise<ActionResult> {
  const parsed = setScheduleIntervalSchema.safeParse(input);
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    await setScheduleInterval(userId, parsed.data.credentialId, parsed.data.intervalMs);
    revalidatePath("/wallet/integrations");
    return { ok: true };
  } catch (e) {
    const safe = toSafeError(e);
    return { ok: false, error: safe.message };
  }
}
