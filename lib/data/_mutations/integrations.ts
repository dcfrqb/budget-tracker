import { IntegrationStatus, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/integrations/crypto";
import { assertAdminIntegrations } from "@/lib/integrations/guard";
import { getAdapter } from "@/lib/integrations/registry";
import { toSafeError } from "@/lib/integrations/safe-error";
import { checkRateLimit } from "@/lib/integrations/rate-limit";
import type { AdapterContext } from "@/lib/integrations/types";
import { findDuplicates } from "@/lib/import/dedupe";
import { getSession } from "@/lib/integrations/playwright/session-registry";

const POST_OTP_STATUS_POLL_MS = 8000;

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
  const result = await adapter.submitOtp(ctx, input);

  if (result.ok && cred.adapterId === "tinkoff-retail") {
    const session = getSession(credentialId);
    if (session) {
      await Promise.race([
        session.promise.catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, POST_OTP_STATUS_POLL_MS)),
      ]);
    }
  }

  return result;
}

/**
 * Sync: fetch transactions from adapter, deduplicate, create new ones.
 * Falls back to last 30 days if range not specified.
 *
 * accountId semantics (dual path):
 *   - Rows with per-row accountId (tinkoff-retail API adapter) → grouped by row.accountId,
 *     each group runs through its own dedupe loop against that account.
 *   - Rows without per-row accountId (CSV adapters) → opts.accountId is used; if not provided,
 *     falls back to the first non-archived account (legacy CSV-import UX).
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
      // ── Split rows into two buckets ───────────────────────────
      // Bucket A: rows that carry their own accountId (tinkoff-retail API path).
      // Bucket B: rows without accountId (CSV adapters — use opts.accountId or fallback).
      const rowsWithAccountId = rows.filter((r) => r.accountId != null);
      const rowsWithoutAccountId = rows.filter((r) => r.accountId == null);

      // ── Bucket A: per-row accountId path ─────────────────────
      if (rowsWithAccountId.length > 0) {
        // Collect unique accountIds and validate they all belong to this user.
        const uniqueAccountIds = [...new Set(rowsWithAccountId.map((r) => r.accountId as string))];
        const validAccounts = await db.account.findMany({
          where: { userId, id: { in: uniqueAccountIds }, deletedAt: null },
          select: { id: true },
        });
        const validAccountIdSet = new Set(validAccounts.map((a) => a.id));

        // Group rows by accountId; silently skip rows whose accountId isn't valid.
        const groups = new Map<string, typeof rowsWithAccountId>();
        for (const row of rowsWithAccountId) {
          const aid = row.accountId as string;
          if (!validAccountIdSet.has(aid)) {
            rowsSkipped++;
            continue;
          }
          if (!groups.has(aid)) groups.set(aid, []);
          groups.get(aid)!.push(row);
        }

        // Run dedupe + insert for each per-account group.
        for (const [accountId, groupRows] of groups) {
          const existing = await db.transaction.findMany({
            where: {
              userId,
              accountId,
              occurredAt: { gte: range.from, lte: range.to },
              deletedAt: null,
            },
            select: { id: true, note: true, occurredAt: true, amount: true, accountId: true },
          });

          const existingForDedupe = existing.map((t) => ({
            externalId: t.note?.startsWith("import:") ? t.note.slice(7) : undefined,
            occurredAt: t.occurredAt,
            amount: t.amount.toString(),
            accountId: t.accountId,
          }));

          const duplicateIndices = findDuplicates(groupRows, existingForDedupe, accountId);

          await db.$transaction(async (tx) => {
            for (let i = 0; i < groupRows.length; i++) {
              if (duplicateIndices.has(i)) {
                rowsSkipped++;
                continue;
              }
              const row = groupRows[i];
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
      }

      // ── Bucket B: legacy single-account path (CSV adapters) ──
      if (rowsWithoutAccountId.length > 0) {
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

        const existing = await db.transaction.findMany({
          where: {
            userId,
            accountId,
            occurredAt: { gte: range.from, lte: range.to },
            deletedAt: null,
          },
          select: { id: true, note: true, occurredAt: true, amount: true, accountId: true },
        });

        const existingForDedupe = existing.map((t) => ({
          externalId: t.note?.startsWith("import:") ? t.note.slice(7) : undefined,
          occurredAt: t.occurredAt,
          amount: t.amount.toString(),
          accountId: t.accountId,
        }));

        const duplicateIndices = findDuplicates(rowsWithoutAccountId, existingForDedupe, accountId);

        await db.$transaction(async (tx) => {
          for (let i = 0; i < rowsWithoutAccountId.length; i++) {
            if (duplicateIndices.has(i)) {
              rowsSkipped++;
              continue;
            }
            const row = rowsWithoutAccountId[i];
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

// ─────────────────────────────────────────────────────────────
// Account link mutations
// ─────────────────────────────────────────────────────────────

/** Link (or re-link) an external bank account to a local account. */
export async function linkExternalAccount(
  userId: string,
  credentialId: string,
  externalAccountId: string,
  accountId: string,
  label?: string,
) {
  assertAdminIntegrations(userId);

  const cred = await db.integrationCredential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true },
  });
  if (!cred) {
    throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
  }

  const account = await db.account.findFirst({
    where: { id: accountId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!account) {
    throw Object.assign(new Error("Account not found"), { code: "NOT_FOUND" });
  }

  const link = await db.integrationAccountLink.upsert({
    where: { credentialId_externalAccountId: { credentialId, externalAccountId } },
    create: { credentialId, externalAccountId, accountId, label: label ?? null },
    update: { accountId, label: label ?? null },
  });

  return { id: link.id, externalAccountId: link.externalAccountId, accountId: link.accountId, label: link.label };
}

/** Remove the link between an external account id and a local account. */
export async function unlinkExternalAccount(
  userId: string,
  credentialId: string,
  externalAccountId: string,
) {
  assertAdminIntegrations(userId);

  const cred = await db.integrationCredential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true },
  });
  if (!cred) {
    throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
  }

  const result = await db.integrationAccountLink.deleteMany({
    where: { credentialId, externalAccountId },
  });

  return { deleted: result.count };
}

/** List all account links for a credential, with joined account details. */
export async function listAccountLinksForCredential(
  userId: string,
  credentialId: string,
) {
  assertAdminIntegrations(userId);

  const cred = await db.integrationCredential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true },
  });
  if (!cred) {
    throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
  }

  const links = await db.integrationAccountLink.findMany({
    where: { credentialId },
    include: {
      account: {
        select: { id: true, name: true, currencyCode: true },
      },
    },
  });

  return links.map((l) => ({
    id: l.id,
    externalAccountId: l.externalAccountId,
    accountId: l.accountId,
    label: l.label,
    accountName: l.account.name,
    accountCurrency: l.account.currencyCode,
  }));
}

/** Re-run the login flow for an existing credential (e.g. after session expiry). */
export async function reloginCredential(
  userId: string,
  credentialId: string,
  input: { phone: string; password: string },
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
  return adapter.login(ctx, { username: input.phone, password: input.password });
}

/** Call adapter.listExternalAccounts() to enumerate bank accounts via the API. */
export async function listExternalAccountsForCredential(
  userId: string,
  credentialId: string,
) {
  assertAdminIntegrations(userId);

  const { cred, secrets } = await loadCredential(userId, credentialId);

  const adapter = getAdapter(cred.adapterId);
  if (!adapter) {
    throw Object.assign(new Error(`Unknown adapter: ${cred.adapterId}`), {
      code: "NOT_FOUND",
    });
  }
  if (!adapter.supports.listExternalAccounts || !adapter.listExternalAccounts) {
    throw Object.assign(
      new Error(`Adapter ${cred.adapterId} does not support listExternalAccounts`),
      { code: "CONFLICT" },
    );
  }

  const ctx = buildContext(userId, credentialId, secrets);
  return adapter.listExternalAccounts(ctx);
}
