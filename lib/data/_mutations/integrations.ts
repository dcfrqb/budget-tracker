import { IntegrationStatus, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/integrations/crypto";
import { assertAdminIntegrations } from "@/lib/integrations/guard";
import { getAdapter } from "@/lib/integrations/registry";
import { toSafeError } from "@/lib/integrations/safe-error";
import { checkRateLimit } from "@/lib/integrations/rate-limit";
import type { AdapterContext } from "@/lib/integrations/types";
import { findDuplicates } from "@/lib/import/dedupe";

// ─────────────────────────────────────────────────────────────
// Integration credential mutations — all guarded by assertAdminIntegrations
// ─────────────────────────────────────────────────────────────

/** List all credentials for user. Secrets are NOT decrypted. */
export async function listCredentials(userId: string) {
  assertAdminIntegrations(userId);
  return db.integrationCredential.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      adapterId: true,
      displayLabel: true,
      status: true,
      lastSyncAt: true,
      lastErrorAt: true,
      lastErrorMessage: true,
      createdAt: true,
      updatedAt: true,
      // Intentionally omitting encryptedPayload / encryptionIv / encryptionTag / keyVersion
    },
  });
}

/** Connect a new adapter. Creates credential record, encrypts initial secrets. */
export async function connectAdapter(
  userId: string,
  adapterId: string,
  initialSecrets: Record<string, unknown>,
  displayLabel?: string,
) {
  assertAdminIntegrations(userId);

  const adapter = getAdapter(adapterId);
  if (!adapter) {
    throw Object.assign(new Error(`Unknown adapter: ${adapterId}`), {
      code: "NOT_FOUND",
    });
  }

  const blob = encrypt(JSON.stringify(initialSecrets));

  // CSV adapters that don't require login are immediately CONNECTED.
  const initialStatus: IntegrationStatus =
    !adapter.supports.login ? "CONNECTED" : "DISCONNECTED";

  return db.integrationCredential.create({
    data: {
      userId,
      adapterId,
      displayLabel: displayLabel ?? null,
      encryptedPayload: blob.ciphertext,
      encryptionIv: blob.iv,
      encryptionTag: blob.tag,
      keyVersion: blob.keyVersion,
      status: initialStatus,
    },
  });
}

/** Build an AdapterContext that persists secrets and status changes back to DB. */
function buildContext(
  userId: string,
  credentialId: string,
  secrets: Record<string, unknown>,
): AdapterContext {
  return {
    credentialId,
    userId,
    secrets,
    async saveSecrets(next: Record<string, unknown>) {
      const blob = encrypt(JSON.stringify(next));
      await db.integrationCredential.update({
        where: { id: credentialId },
        data: {
          encryptedPayload: blob.ciphertext,
          encryptionIv: blob.iv,
          encryptionTag: blob.tag,
          keyVersion: blob.keyVersion,
        },
      });
      // Mutate in-place so the same context object stays current
      for (const k of Object.keys(secrets)) delete secrets[k];
      Object.assign(secrets, next);
    },
    async setStatus(status: IntegrationStatus, err?: string) {
      const safeErr = err ? toSafeError(err).message : undefined;
      await db.integrationCredential.update({
        where: { id: credentialId },
        data: {
          status,
          lastErrorAt: safeErr ? new Date() : undefined,
          lastErrorMessage: safeErr ?? null,
        },
      });
    },
  };
}

/** Load credential and decrypt secrets. */
async function loadCredential(userId: string, credentialId: string) {
  const cred = await db.integrationCredential.findFirst({
    where: { id: credentialId, userId },
  });
  if (!cred) {
    throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
  }

  let secrets: Record<string, unknown> = {};
  if (cred.encryptedPayload) {
    try {
      const plain = decrypt({
        ciphertext: cred.encryptedPayload,
        iv: cred.encryptionIv,
        tag: cred.encryptionTag,
        keyVersion: cred.keyVersion,
      });
      secrets = JSON.parse(plain) as Record<string, unknown>;
    } catch {
      secrets = {};
    }
  }

  return { cred, secrets };
}

/** Call adapter.login() with the provided credentials. */
export async function loginWithCredential(
  userId: string,
  credentialId: string,
  input: { username: string; password: string },
) {
  assertAdminIntegrations(userId);

  const { cred, secrets } = await loadCredential(userId, credentialId);

  const adapter = getAdapter(cred.adapterId);
  if (!adapter) {
    throw Object.assign(new Error(`Unknown adapter: ${cred.adapterId}`), {
      code: "NOT_FOUND",
    });
  }
  if (!adapter.login) {
    throw Object.assign(
      new Error(`Adapter ${cred.adapterId} does not support login`),
      { code: "CONFLICT" },
    );
  }

  const ctx = buildContext(userId, credentialId, secrets);
  return adapter.login(ctx, input);
}

/** Call adapter.submitOtp(). */
export async function submitOtpForCredential(
  userId: string,
  credentialId: string,
  input: { code: string },
) {
  assertAdminIntegrations(userId);

  const { cred, secrets } = await loadCredential(userId, credentialId);

  const adapter = getAdapter(cred.adapterId);
  if (!adapter) {
    throw Object.assign(new Error(`Unknown adapter: ${cred.adapterId}`), {
      code: "NOT_FOUND",
    });
  }
  if (!adapter.submitOtp) {
    throw Object.assign(
      new Error(`Adapter ${cred.adapterId} does not support OTP`),
      { code: "CONFLICT" },
    );
  }

  const ctx = buildContext(userId, credentialId, secrets);
  return adapter.submitOtp(ctx, input);
}

/**
 * Sync: fetch transactions from adapter, deduplicate, create new ones.
 * Falls back to last 30 days if range not specified.
 * Requires an accountId to attach transactions to.
 */
export async function syncCredential(
  userId: string,
  credentialId: string,
  opts?: { range?: { from: Date; to: Date }; accountId?: string },
) {
  assertAdminIntegrations(userId);

  const { cred, secrets } = await loadCredential(userId, credentialId);

  const adapter = getAdapter(cred.adapterId);
  if (!adapter) {
    throw Object.assign(new Error(`Unknown adapter: ${cred.adapterId}`), {
      code: "NOT_FOUND",
    });
  }
  if (!adapter.fetchTransactions) {
    throw Object.assign(
      new Error(`Adapter ${cred.adapterId} does not support fetchTransactions`),
      { code: "CONFLICT" },
    );
  }

  // ── Rate limit + circuit breaker ─────────────────────────────
  const rateLimitDecision = await checkRateLimit({
    id: cred.id,
    adapterId: cred.adapterId,
    lastSyncAt: cred.lastSyncAt,
  });

  if (!rateLimitDecision.ok) {
    // Record the blocked attempt in sync log (metadata only — no payload).
    await db.integrationSyncLog.create({
      data: {
        credentialId,
        status: rateLimitDecision.reason === "rate_limited"
          ? "RATE_LIMITED"
          : "CIRCUIT_OPEN",
        finishedAt: new Date(),
        durationMs: 0,
        rowsCreated: 0,
        rowsSkipped: 0,
      },
    });

    if (rateLimitDecision.reason === "rate_limited") {
      throw Object.assign(
        new Error(
          `rate_limited: retry after ${Math.ceil(rateLimitDecision.retryAfterMs / 1000)}s`,
        ),
        { code: "CONFLICT" },
      );
    } else {
      throw Object.assign(
        new Error(
          `circuit_open: ${rateLimitDecision.consecutiveErrors} consecutive errors`,
        ),
        { code: "CONFLICT" },
      );
    }
  }

  // ── Create RUNNING sync log entry ─────────────────────────────
  const syncLogStart = new Date();
  const syncLog = await db.integrationSyncLog.create({
    data: {
      credentialId,
      status: "RUNNING",
    },
  });

  let rowsCreated = 0;
  let rowsSkipped = 0;
  let safeErr: { class: string; message: string } | undefined;

  try {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const range = opts?.range ?? { from, to };

    const ctx = buildContext(userId, credentialId, secrets);
    const rows = await adapter.fetchTransactions(ctx, range);

    if (rows.length > 0) {
      // If no accountId provided, try to use the first available non-archived account
      let accountId = opts?.accountId;
      if (!accountId) {
        const fallback = await db.account.findFirst({
          where: { userId, deletedAt: null, isArchived: false },
          select: { id: true },
          orderBy: { sortOrder: "asc" },
        });
        if (!fallback) {
          throw Object.assign(
            new Error("No active account found. Please specify an accountId."),
            { code: "CONFLICT" },
          );
        }
        accountId = fallback.id;
      }

      // Load existing transactions for deduplication
      const existing = await db.transaction.findMany({
        where: {
          userId,
          accountId,
          occurredAt: { gte: range.from, lte: range.to },
          deletedAt: null,
        },
        select: {
          id: true,
          note: true,
          occurredAt: true,
          amount: true,
          accountId: true,
        },
      });

      // Map existing to ExistingTransaction shape (note field contains externalId as "import:...")
      const existingForDedupe = existing.map((t) => ({
        externalId: t.note?.startsWith("import:") ? t.note.slice(7) : undefined,
        occurredAt: t.occurredAt,
        amount: t.amount.toString(),
        accountId: t.accountId,
      }));

      const duplicateIndices = findDuplicates(rows, existingForDedupe, accountId);

      await db.$transaction(async (tx) => {
        for (let i = 0; i < rows.length; i++) {
          if (duplicateIndices.has(i)) {
            rowsSkipped++;
            continue;
          }
          const row = rows[i];
          const kind =
            row.kind === "INCOME" ? TransactionKind.INCOME : TransactionKind.EXPENSE;

          const name = row.description ?? row.rawCategory ?? "Sync import";

          await tx.transaction.create({
            data: {
              userId,
              accountId,
              kind,
              status: TransactionStatus.DONE,
              amount: row.amount,
              currencyCode: row.currencyCode,
              occurredAt: new Date(row.occurredAt),
              name: name.substring(0, 240),
              note: row.externalId ? `import:${row.externalId}` : null,
            },
          });
          rowsCreated++;
        }
      });
    }

    // Update lastSyncAt on success
    await db.integrationCredential.update({
      where: { id: credentialId },
      data: { lastSyncAt: new Date() },
    });
  } catch (e) {
    safeErr = toSafeError(e);

    // Propagate original error after capturing safe classification
    throw e;
  } finally {
    // ── Finalize sync log — metadata only, no payloads ───────────
    const finishedAt = new Date();
    await db.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt,
        durationMs: finishedAt.getTime() - syncLogStart.getTime(),
        status: safeErr ? "ERROR" : "OK",
        rowsCreated,
        rowsSkipped,
        errorClass: safeErr?.class ?? null,
      },
    }).catch(() => {
      // Best-effort — don't shadow the original error if log update fails.
    });
  }

  return { created: rowsCreated, skipped: rowsSkipped };
}

/** Disconnect: clear secrets, set status to DISCONNECTED. */
export async function disconnectCredential(userId: string, credentialId: string) {
  assertAdminIntegrations(userId);

  const cred = await db.integrationCredential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true, adapterId: true },
  });
  if (!cred) {
    throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
  }

  const adapter = getAdapter(cred.adapterId);
  if (adapter?.disconnect) {
    const { secrets } = await loadCredential(userId, credentialId);
    const ctx = buildContext(userId, credentialId, secrets);
    await adapter.disconnect(ctx);
  } else {
    // Manually clear secrets and set status
    const emptyBlob = encrypt(JSON.stringify({}));
    await db.integrationCredential.update({
      where: { id: credentialId },
      data: {
        encryptedPayload: emptyBlob.ciphertext,
        encryptionIv: emptyBlob.iv,
        encryptionTag: emptyBlob.tag,
        keyVersion: emptyBlob.keyVersion,
        status: "DISCONNECTED",
        lastErrorMessage: null,
      },
    });
  }
}

/** Hard delete credential. */
export async function deleteCredential(userId: string, credentialId: string) {
  assertAdminIntegrations(userId);

  const cred = await db.integrationCredential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true },
  });
  if (!cred) {
    throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
  }

  await db.integrationCredential.delete({ where: { id: credentialId } });
}
