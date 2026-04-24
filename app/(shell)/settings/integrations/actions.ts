"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  connectAdapter,
  loginWithCredential,
  submitOtpForCredential,
  syncCredential,
  disconnectCredential,
  deleteCredential,
} from "@/lib/data/_mutations/integrations";

// ─────────────────────────────────────────────────────────────
// Server actions for integration credential management.
// All are guarded by assertAdminIntegrations inside each mutation.
// ─────────────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

/** Connect a new adapter (creates credential record). */
export async function connectAdapterAction(
  adapterId: string,
  input: Record<string, string>,
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const { displayLabel, ...rest } = input;
    const initialSecrets: Record<string, unknown> = rest;
    const credential = await connectAdapter(
      userId,
      adapterId,
      initialSecrets,
      displayLabel,
    );
    revalidatePath("/settings/integrations");
    return { ok: true, data: { id: credential.id } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Trigger login flow (username + password). */
export async function loginAction(
  credentialId: string,
  input: { username: string; password: string },
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const result = await loginWithCredential(userId, credentialId, input);
    revalidatePath("/settings/integrations");
    return { ok: true, data: result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Submit OTP code. */
export async function submitOtpAction(
  credentialId: string,
  input: { code: string },
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const result = await submitOtpForCredential(userId, credentialId, input);
    revalidatePath("/settings/integrations");
    return { ok: true, data: result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Trigger sync (fetchTransactions + create). */
export async function syncAction(credentialId: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const result = await syncCredential(userId, credentialId);
    revalidatePath("/settings/integrations");
    revalidatePath("/transactions");
    return { ok: true, data: result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Disconnect (clear secrets, DISCONNECTED status). */
export async function disconnectAction(
  credentialId: string,
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await disconnectCredential(userId, credentialId);
    revalidatePath("/settings/integrations");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Hard delete credential. */
export async function deleteCredentialAction(
  credentialId: string,
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await deleteCredential(userId, credentialId);
    revalidatePath("/settings/integrations");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
