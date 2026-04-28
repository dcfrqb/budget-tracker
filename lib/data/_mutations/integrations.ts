import { AccountKind, IntegrationStatus, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/integrations/crypto";
import { assertAdminIntegrations } from "@/lib/integrations/guard";
import { getAdapter } from "@/lib/integrations/registry";
import { toSafeError } from "@/lib/integrations/safe-error";
import { checkRateLimit } from "@/lib/integrations/rate-limit";
import type { AdapterContext } from "@/lib/integrations/types";
import { findDuplicates } from "@/lib/import/dedupe";
import { getSession } from "@/lib/integrations/playwright/session-registry";

// Increased from 20 000 — state machine path through password+pin_setup+pin_confirm can take up to 45s in worst case.
const POST_OTP_STATUS_POLL_MS = 45_000;

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
  input: { username: string; password: string; lkPassword?: string },
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

  if (!result.ok && result.error === "no_pending_sms") {
    await ctx.setStatus("ERROR", "session_expired");
  }

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
    const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);
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
            select: { id: true, externalId: true, occurredAt: true, amount: true, accountId: true },
          });

          const existingForDedupe = existing.map((t) => ({
            externalId: t.externalId ?? undefined,
            occurredAt: t.occurredAt,
            amount: t.amount.toString(),
            accountId: t.accountId,
          }));

          // Rows with externalId are deduped via DB upsert (importDedupe constraint).
          // Rows without externalId use fuzzy dedupe to prevent near-duplicates.
          const rowsWithoutExtId = groupRows.filter((r) => !r.externalId);
          const fuzzyDuplicateIndices = findDuplicates(rowsWithoutExtId, existingForDedupe, accountId);

          const countBefore = await db.transaction.count({ where: { userId, accountId, source: "tinkoff-retail" } });

          await db.$transaction(async (tx) => {
            for (let i = 0; i < groupRows.length; i++) {
              const row = groupRows[i];
              const kind =
                row.kind === "INCOME" ? TransactionKind.INCOME : TransactionKind.EXPENSE;
              const name = (row.description ?? row.rawCategory ?? "Sync import").substring(0, 240);

              if (row.externalId) {
                // Upsert: DB constraint importDedupe(accountId, source, externalId) handles dedupe.
                await tx.transaction.upsert({
                  where: {
                    importDedupe: {
                      accountId,
                      source: "tinkoff-retail",
                      externalId: row.externalId,
                    },
                  },
                  update: {
                    amount: row.amount,
                    name,
                    occurredAt: new Date(row.occurredAt),
                  },
                  create: {
                    userId,
                    accountId,
                    kind,
                    status: TransactionStatus.DONE,
                    amount: row.amount,
                    currencyCode: row.currencyCode,
                    occurredAt: new Date(row.occurredAt),
                    name,
                    externalId: row.externalId,
                    source: "tinkoff-retail",
                  },
                });
              } else {
                // No externalId — fuzzy dedupe to avoid near-duplicate plain rows.
                const localIdx = rowsWithoutExtId.indexOf(row);
                if (localIdx !== -1 && fuzzyDuplicateIndices.has(localIdx)) {
                  rowsSkipped++;
                  continue;
                }
                await tx.transaction.create({
                  data: {
                    userId,
                    accountId,
                    kind,
                    status: TransactionStatus.DONE,
                    amount: row.amount,
                    currencyCode: row.currencyCode,
                    occurredAt: new Date(row.occurredAt),
                    name,
                  },
                });
              }
              rowsCreated++;
            }
          });

          const countAfter = await db.transaction.count({ where: { userId, accountId, source: "tinkoff-retail" } });
          const insertedCount = countAfter - countBefore;
          const updatedCount = groupRows.filter((r) => r.externalId).length - insertedCount;
          console.log(`[playwright-tbank] persistImportRows: total=${groupRows.length} inserted=${insertedCount} updated=${Math.max(0, updatedCount)} skipped=${rowsSkipped}`);
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
          select: { id: true, externalId: true, occurredAt: true, amount: true, accountId: true },
        });

        const existingForDedupe = existing.map((t) => ({
          externalId: t.externalId ?? undefined,
          occurredAt: t.occurredAt,
          amount: t.amount.toString(),
          accountId: t.accountId,
        }));

        // Rows with externalId are deduped via DB upsert (importDedupe constraint).
        // Rows without externalId use fuzzy dedupe to prevent near-duplicates.
        const rowsWithoutExtIdB = rowsWithoutAccountId.filter((r) => !r.externalId);
        const fuzzyDuplicateIndicesB = findDuplicates(rowsWithoutExtIdB, existingForDedupe, accountId);

        await db.$transaction(async (tx) => {
          for (let i = 0; i < rowsWithoutAccountId.length; i++) {
            const row = rowsWithoutAccountId[i];
            const kind =
              row.kind === "INCOME" ? TransactionKind.INCOME : TransactionKind.EXPENSE;
            const name = (row.description ?? row.rawCategory ?? "Sync import").substring(0, 240);

            if (row.externalId) {
              // Upsert: DB constraint importDedupe(accountId, source, externalId) handles dedupe.
              await tx.transaction.upsert({
                where: {
                  importDedupe: {
                    accountId,
                    source: "tinkoff-retail",
                    externalId: row.externalId,
                  },
                },
                update: {
                  amount: row.amount,
                  name,
                  occurredAt: new Date(row.occurredAt),
                },
                create: {
                  userId,
                  accountId,
                  kind,
                  status: TransactionStatus.DONE,
                  amount: row.amount,
                  currencyCode: row.currencyCode,
                  occurredAt: new Date(row.occurredAt),
                  name,
                  externalId: row.externalId,
                  source: "tinkoff-retail",
                },
              });
            } else {
              // No externalId — fuzzy dedupe to avoid near-duplicate plain rows.
              const localIdx = rowsWithoutExtIdB.indexOf(row);
              if (localIdx !== -1 && fuzzyDuplicateIndicesB.has(localIdx)) {
                rowsSkipped++;
                continue;
              }
              await tx.transaction.create({
                data: {
                  userId,
                  accountId,
                  kind,
                  status: TransactionStatus.DONE,
                  amount: row.amount,
                  currencyCode: row.currencyCode,
                  occurredAt: new Date(row.occurredAt),
                  name,
                },
              });
            }
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

/**
 * Create an Account from external metadata and atomically link it to the credential.
 * Intended for the "Создать счёт и привязать" one-click flow when the DB has no
 * pre-existing Account row for the external account.
 */
export async function createAccountAndLink(
  userId: string,
  input: {
    credentialId: string;
    externalAccountId: string;
    label: string;
    currencyCode: string;
    accountType: string;
    balance?: string;
  },
): Promise<{ accountId: string; linkId: string }> {
  assertAdminIntegrations(userId);

  const cred = await db.integrationCredential.findFirst({
    where: { id: input.credentialId, userId },
    select: { id: true },
  });
  if (!cred) {
    throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
  }

  function mapAccountType(t: string): AccountKind {
    const upper = t.toUpperCase();
    if (["CURRENT", "DEBIT", "DEBITCARD"].includes(upper)) return AccountKind.CARD;
    if (["CREDIT", "CREDITCARD"].includes(upper)) return AccountKind.CREDIT;
    if (["SAVING", "DEPOSIT", "SAVINGSACCOUNT"].includes(upper)) return AccountKind.SAVINGS;
    console.warn(`[playwright-tbank] createAccountAndLink: unknown accountType="${t}", defaulting to CARD`);
    return AccountKind.CARD;
  }

  const kind = mapAccountType(input.accountType);

  return db.$transaction(async (tx) => {
    const newAccount = await tx.account.create({
      data: {
        userId,
        name: input.label,
        currencyCode: input.currencyCode,
        kind,
        balance: input.balance ?? 0,
        balanceUpdatedAt: input.balance !== undefined ? new Date() : null,
        includeInAnalytics: true,
        sortOrder: 0,
      },
    });

    const newLink = await tx.integrationAccountLink.create({
      data: {
        credentialId: input.credentialId,
        externalAccountId: input.externalAccountId,
        accountId: newAccount.id,
        label: input.label,
      },
    });

    return { accountId: newAccount.id, linkId: newLink.id };
  });
}

/**
 * Refresh balances on already-linked Accounts using fresh data from
 * adapter.listExternalAccounts. Called from listExternalAccountsForCredential
 * so that clicking "Связи счетов" refreshes balances on the existing accounts.
 */
async function refreshLinkedAccountBalances(
  credentialId: string,
  externals: Array<{ externalAccountId: string; balance?: string }>,
): Promise<void> {
  const links = await db.integrationAccountLink.findMany({
    where: { credentialId },
    select: { externalAccountId: true, accountId: true },
  });
  const byExternal = new Map(links.map((l) => [l.externalAccountId, l.accountId]));
  const updates: Array<Promise<unknown>> = [];
  for (const ext of externals) {
    if (ext.balance === undefined) continue;
    const accountId = byExternal.get(ext.externalAccountId);
    if (!accountId) continue;
    updates.push(
      db.account.update({
        where: { id: accountId },
        data: { balance: ext.balance, balanceUpdatedAt: new Date() },
      }),
    );
  }
  if (updates.length > 0) {
    console.log(`[playwright-tbank] refreshLinkedAccountBalances: updating ${updates.length} accounts`);
    await Promise.all(updates);
  }
}

/** Re-run the login flow for an existing credential (e.g. after session expiry). */
export async function reloginCredential(
  userId: string,
  credentialId: string,
  input: { phone: string; password: string; lkPassword?: string },
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
  return adapter.login(ctx, { username: input.phone, password: input.password, lkPassword: input.lkPassword });
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
  const externals = await adapter.listExternalAccounts(ctx);
  // Backfill balances on already-linked Accounts so existing links pick up
  // fresh balance values without requiring delete+recreate.
  await refreshLinkedAccountBalances(credentialId, externals).catch((err) => {
    console.warn(`[playwright-tbank] refreshLinkedAccountBalances failed: ${err instanceof Error ? err.message : String(err)}`);
  });
  return externals;
}
