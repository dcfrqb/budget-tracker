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
} from "@/lib/data/_mutations/integrations";
import {
  connectInputSchema,
  loginInputSchema,
  submitOtpSchema,
  disconnectInputSchema,
  deleteCredentialSchema,
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
    const initialSecrets: Record<string, unknown> = rest;
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
  input: { username: string; password: string },
): Promise<ActionResult> {
  // Validate: credentialId format + password presence
  const parsed = loginInputSchema.safeParse({ credentialId, password: input.password });
  if (!parsed.success) return toValidationFailure(parsed.error);

  try {
    const userId = await getCurrentUserId();
    const result = await loginWithCredential(userId, credentialId, input);
    revalidatePath("/settings/integrations");
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
