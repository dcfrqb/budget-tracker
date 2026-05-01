import { AccountKind, IntegrationStatus, TransactionKind, TransactionStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/integrations/crypto";
import { assertAdminIntegrations } from "@/lib/integrations/guard";
import { getAdapter } from "@/lib/integrations/registry";
import { toSafeError } from "@/lib/integrations/safe-error";
import { checkRateLimit } from "@/lib/integrations/rate-limit";
import type { AdapterContext } from "@/lib/integrations/types";
import { findDuplicates } from "@/lib/import/dedupe";
import { getSession } from "@/lib/integrations/playwright/session-registry";
import { resolveCategoryId } from "@/lib/integrations/category-map/resolve";

// Increased from 20 000 — state machine path through password+pin_setup+pin_confirm can take up to 45s in worst case.
const POST_OTP_STATUS_POLL_MS = 45_000;

// Max transactions per DB transaction to avoid Prisma 5s default timeout on large syncs.
const PERSIST_CHUNK_SIZE = 200;

type DbOrTx = typeof db | Prisma.TransactionClient;

async function ensureTbankInstitution(client: DbOrTx, userId: string): Promise<string> {
  const existing = await client.institution.findFirst({
    where: { userId, name: "Т банк", kind: "BANK" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await client.institution.create({
    data: { userId, name: "Т банк", kind: "BANK" },
  });
  return created.id;
}

async function ensureIntegrationInstitution(client: DbOrTx, userId: string, adapterId: string): Promise<string> {
  if (adapterId === "bybit-card") {
    const existing = await client.institution.findFirst({
      where: { userId, name: "Bybit", kind: "CRYPTO" },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await client.institution.create({
      data: { userId, name: "Bybit", kind: "CRYPTO" },
    });
    return created.id;
  }
  return ensureTbankInstitution(client, userId);
}

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
      autosyncEnabled: true,
      scheduleIntervalMs: true,
      nextScheduledAt: true,
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
  if (!adapter.fetchTransactions && !adapter.runSync) {
    throw Object.assign(
      new Error(`Adapter ${cred.adapterId} does not support fetchTransactions or runSync`),
      { code: "CONFLICT" },
    );
  }

  // ── Rate limit + circuit breaker ─────────────────────────────
  const rateLimitDecision = await checkRateLimit(
    {
      id: cred.id,
      adapterId: cred.adapterId,
      lastSyncAt: cred.lastSyncAt,
    },
    adapter,
  );

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
  let rowsUpdated = 0;
  let rowsSkipped = 0;
  let safeErr: { class: string; message: string } | undefined;

  try {
    const FULL_SYNC_DAYS = 365;
    const INCREMENTAL_BUFFER_HOURS = 24;
    const to = new Date();
    const fullFrom = new Date(to.getTime() - FULL_SYNC_DAYS * 24 * 60 * 60 * 1000);

    let from: Date;
    if (cred.lastSyncAt && cred.lastSyncAt.getTime() > fullFrom.getTime()) {
      from = new Date(cred.lastSyncAt.getTime() - INCREMENTAL_BUFFER_HOURS * 60 * 60 * 1000);
      console.log(`[playwright-tbank] sync: incremental from=${from.toISOString()} (lastSyncAt=${cred.lastSyncAt.toISOString()})`);
    } else {
      from = fullFrom;
      console.log(`[playwright-tbank] sync: full backfill from=${from.toISOString()} (lastSyncAt=${cred.lastSyncAt?.toISOString() ?? "null"})`);
    }
    const range = opts?.range ?? { from, to };

    const ctx = buildContext(userId, credentialId, secrets);

    // ── Stage: fetch accounts + transactions ─────────────────────
    type ExternalsList = Awaited<ReturnType<NonNullable<typeof adapter.listExternalAccounts>>>;
    let externals: ExternalsList = [];
    let rows: Awaited<ReturnType<NonNullable<typeof adapter.fetchTransactions>>>;
    let cardLast4ByExternal = new Map<string, string[]>();

    if (adapter.runSync) {
      // Single browser launch path (Tinkoff playwright adapter)
      try {
        const result = await adapter.runSync(ctx, range);
        externals = result.externals;
        rows = result.rows;
        cardLast4ByExternal = result.cardLast4ByExternal;
      } catch (err) {
        console.error(`[playwright-tbank] sync: runSync failed: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    } else {
      // Legacy two-call path for adapters without runSync (CSV, email-forward)
      if (adapter.listExternalAccounts) {
        try {
          externals = await adapter.listExternalAccounts(ctx);
        } catch (err) {
          console.error(`[playwright-tbank] sync: accounts_refresh failed: ${err instanceof Error ? err.message : String(err)}`);
          // soft-fail
        }
      }
      try {
        rows = await adapter.fetchTransactions!(ctx, range);
      } catch (err) {
        console.error(`[playwright-tbank] sync: fetch_transactions failed: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    }

    // Merge cardLast4 from operations into externals before refresh
    for (const ext of externals) {
      const fromOps = cardLast4ByExternal.get(ext.externalAccountId);
      if (fromOps && fromOps.length > 0) {
        ext.cardLast4 = Array.from(new Set([...(ext.cardLast4 ?? []), ...fromOps]));
      }
    }

    if (externals.length > 0) {
      await refreshLinkedAccounts(userId, credentialId, cred.adapterId, externals);
      console.log(`[playwright-tbank] sync: accounts_refresh ok count=${externals.length}`);
    }

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

        // Run dedupe + chunked insert for each per-account group.
        for (const [accountId, groupRows] of groups) {
          // Upsert any unknown currency codes before writing transactions.
          // Idempotent: already-seeded codes (RUB, USD, EUR…) are no-ops.
          const distinctCodes = [...new Set(groupRows.map((r) => r.currencyCode))];
          await Promise.all(
            distinctCodes.map((code) =>
              db.currency.upsert({
                where: { code },
                update: {},
                create: { code, name: code, symbol: code, decimals: 2 },
              }),
            ),
          );

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

          // Resolve categoryId for each new row before entering transactions.
          // Only on create branch — updates never clobber manual categorization.
          const resolvedCategoryIds = await Promise.all(
            groupRows.map((row) =>
              resolveCategoryId({
                userId,
                mcc: row.raw?.mcc as string | undefined,
                rawCategoryName: (row.raw?.rawCategoryName as string | undefined) ?? row.rawCategory,
                merchantName: row.raw?.merchantName as string | undefined,
              }).catch(() => null),
            ),
          );

          const rowSource = groupRows[0]?.source ?? cred.adapterId;
          const countBefore = await db.transaction.count({ where: { userId, accountId, source: rowSource } });

          for (let chunkStart = 0; chunkStart < groupRows.length; chunkStart += PERSIST_CHUNK_SIZE) {
            const chunk = groupRows.slice(chunkStart, chunkStart + PERSIST_CHUNK_SIZE);
            try {
              await db.$transaction(async (tx) => {
                for (let i = 0; i < chunk.length; i++) {
                  const row = chunk[i];
                  const rowIdx = chunkStart + i;
                  const kind =
                    row.kind === "INCOME" ? TransactionKind.INCOME :
                    row.kind === "TRANSFER" ? TransactionKind.TRANSFER :
                    TransactionKind.EXPENSE;
                  const name = (row.description ?? row.rawCategory ?? "Sync import").substring(0, 240);
                  const source = row.source ?? cred.adapterId;
                  const categoryId = resolvedCategoryIds[rowIdx] ?? null;

                  if (row.externalId) {
                    // Upsert: DB constraint importDedupe(accountId, source, externalId) handles dedupe.
                    await tx.transaction.upsert({
                      where: {
                        importDedupe: {
                          accountId,
                          source,
                          externalId: row.externalId,
                        },
                      },
                      update: {
                        kind,
                        amount: row.amount,
                        name,
                        occurredAt: new Date(row.occurredAt),
                        ...(row.note !== undefined ? { note: row.note } : {}),
                        // do not update categoryId — preserve manual re-categorization
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
                        source,
                        ...(row.note !== undefined ? { note: row.note } : {}),
                        ...(categoryId !== null ? { categoryId } : {}),
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
                        ...(row.note !== undefined ? { note: row.note } : {}),
                        ...(categoryId !== null ? { categoryId } : {}),
                      },
                    });
                  }
                }
              }, { timeout: 30_000 });
              console.log(`[playwright-tbank] sync: chunk ok account=${accountId} ${chunkStart}-${chunkStart + chunk.length}/${groupRows.length}`);
            } catch (err) {
              console.error(`[playwright-tbank] sync: chunk_persist failed account=${accountId} range=${chunkStart}-${chunkStart + chunk.length}: ${err instanceof Error ? err.message : String(err)}`);
              throw err;
            }
          }

          // True insert/update split via row-count delta (upsert path) + plain-create count (no-extId path).
          const countAfter = await db.transaction.count({ where: { userId, accountId, source: rowSource } });
          const insertedCount = countAfter - countBefore;
          const updatedCount = Math.max(0, groupRows.filter((r) => r.externalId).length - insertedCount);
          rowsCreated += insertedCount;
          rowsUpdated += updatedCount;
          console.log(`[playwright-tbank] persistImportRows: total=${groupRows.length} inserted=${insertedCount} updated=${updatedCount} skipped=${rowsSkipped}`);
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

        const countBeforeB = await db.transaction.count({ where: { userId, accountId } });

        for (let chunkStart = 0; chunkStart < rowsWithoutAccountId.length; chunkStart += PERSIST_CHUNK_SIZE) {
          const chunk = rowsWithoutAccountId.slice(chunkStart, chunkStart + PERSIST_CHUNK_SIZE);
          try {
            await db.$transaction(async (tx) => {
              for (let i = 0; i < chunk.length; i++) {
                const row = chunk[i];
                const kind =
                  row.kind === "INCOME" ? TransactionKind.INCOME :
                  row.kind === "TRANSFER" ? TransactionKind.TRANSFER :
                  TransactionKind.EXPENSE;
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
                      kind,
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
              }
            }, { timeout: 30_000 });
            console.log(`[playwright-tbank] sync: chunk ok account=${accountId} ${chunkStart}-${chunkStart + chunk.length}/${rowsWithoutAccountId.length}`);
          } catch (err) {
            console.error(`[playwright-tbank] sync: chunk_persist failed account=${accountId} range=${chunkStart}-${chunkStart + chunk.length}: ${err instanceof Error ? err.message : String(err)}`);
            throw err;
          }
        }

        // True insert/update split via row-count delta.
        const countAfterB = await db.transaction.count({ where: { userId, accountId } });
        const insertedCountB = countAfterB - countBeforeB;
        const updatedCountB = Math.max(0, rowsWithoutAccountId.filter((r) => r.externalId).length - insertedCountB);
        rowsCreated += insertedCountB;
        rowsUpdated += updatedCountB;
        console.log(`[playwright-tbank] persistImportRows: total=${rowsWithoutAccountId.length} inserted=${insertedCountB} updated=${updatedCountB} skipped=${rowsSkipped}`);
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

    if (safeErr) {
      // Backstop: ensure credential surfaces an error even if no adapter setStatus("ERROR") happened.
      await db.integrationCredential.update({
        where: { id: credentialId },
        data: {
          lastErrorAt: new Date(),
          lastErrorMessage: safeErr.message.slice(0, 500),
        },
      }).catch(() => {});
    }
  }

  return {
    created: rowsCreated,
    updated: rowsUpdated,
    skipped: rowsSkipped,
    errorClass: safeErr?.class ?? null,
    syncLogId: syncLog.id,
  };
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
    select: { id: true, adapterId: true },
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
    const institutionId = await ensureIntegrationInstitution(tx, userId, cred.adapterId);
    const newAccount = await tx.account.create({
      data: {
        userId,
        institutionId,
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

/** Do not clobber a field the user has set manually: only write if current is null/undefined or equal to incoming. */
function preferExisting<T>(current: T | null | undefined, incoming: T | null | undefined): T | null | undefined {
  if (current != null && current !== incoming) return current;
  return incoming ?? null;
}

/**
 * Refresh metadata on already-linked Accounts using fresh data from
 * adapter.listExternalAccounts. Updates balance, cardLast4, creditLimit,
 * debtBalance, minPaymentFixed, inn, kpp, correspondentAccount, paymentDueDay,
 * and backfills institutionId if missing.
 */
async function refreshLinkedAccounts(
  userId: string,
  credentialId: string,
  adapterId: string,
  externals: Array<{
    externalAccountId: string;
    balance?: string;
    cardLast4?: string[];
    creditLimit?: string;
    debtBalance?: string;
    currentMinimalPayment?: string;
    requisites?: {
      inn?: string;
      kpp?: string;
      correspondentAccount?: string;
      bic?: string;
      bankName?: string;
      recipientName?: string;
    };
    paymentDueDay?: number;
  }>,
): Promise<void> {
  const links = await db.integrationAccountLink.findMany({
    where: { credentialId },
    select: { externalAccountId: true, accountId: true },
  });
  const byExternal = new Map(links.map((l) => [l.externalAccountId, l.accountId]));

  for (const ext of externals) {
    const accountId = byExternal.get(ext.externalAccountId);
    if (!accountId) continue;

    const account = await db.account.findUnique({
      where: { id: accountId },
      select: { cardLast4: true, institutionId: true, inn: true, kpp: true, correspondentAccount: true, paymentDueDay: true },
    });
    if (!account) continue;

    const updateData: Prisma.AccountUpdateInput = {};

    if (ext.balance !== undefined) {
      updateData.balance = ext.balance;
      updateData.balanceUpdatedAt = new Date();
    }

    if (ext.cardLast4 && ext.cardLast4.length > 0) {
      const union = Array.from(new Set([...account.cardLast4, ...ext.cardLast4]));
      if (union.length !== account.cardLast4.length || union.some((v, i) => v !== account.cardLast4[i])) {
        updateData.cardLast4 = union;
      }
    }

    if (ext.creditLimit !== undefined) {
      updateData.creditLimit = ext.creditLimit;
    }

    if (ext.currentMinimalPayment !== undefined) {
      updateData.minPaymentFixed = ext.currentMinimalPayment;
    }

    if (ext.debtBalance !== undefined) {
      updateData.debtBalance = ext.debtBalance;
    }

    // Write requisites only if incoming is non-null and existing is null (don't clobber manual overrides)
    if (ext.requisites) {
      const inn = preferExisting(account.inn, ext.requisites.inn ?? null);
      if (inn !== account.inn) updateData.inn = inn;

      const kpp = preferExisting(account.kpp, ext.requisites.kpp ?? null);
      if (kpp !== account.kpp) updateData.kpp = kpp;

      const correspondentAccount = preferExisting(account.correspondentAccount, ext.requisites.correspondentAccount ?? null);
      if (correspondentAccount !== account.correspondentAccount) updateData.correspondentAccount = correspondentAccount;
    }

    if (ext.paymentDueDay !== undefined) {
      const paymentDueDay = preferExisting(account.paymentDueDay, ext.paymentDueDay);
      if (paymentDueDay !== account.paymentDueDay) updateData.paymentDueDay = paymentDueDay ?? undefined;
    }

    if (account.institutionId === null) {
      const institutionId = await ensureIntegrationInstitution(db, userId, adapterId);
      updateData.institution = { connect: { id: institutionId } };
    }

    if (Object.keys(updateData).length > 0) {
      await db.account.update({ where: { id: accountId }, data: updateData });
      console.log(`[playwright-tbank] refreshLinkedAccounts: accountId=${accountId} balance=${ext.balance ?? "n/a"} cardLast4Union=${JSON.stringify(ext.cardLast4 ?? [])} creditLimit=${ext.creditLimit ?? "n/a"} debtBalance=${ext.debtBalance ?? "n/a"}`);
    }
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
  // Backfill metadata on already-linked Accounts so existing links pick up
  // fresh balance, cardLast4, creditLimit, institutionId without delete+recreate.
  await refreshLinkedAccounts(userId, credentialId, cred.adapterId, externals).catch((err) => {
    console.warn(`[playwright-tbank] refreshLinkedAccounts failed: ${err instanceof Error ? err.message : String(err)}`);
  });
  return externals;
}

// ─────────────────────────────────────────────────────────────
// Autosync schedule cadence
// ─────────────────────────────────────────────────────────────

/**
 * Update the autosync schedule for a credential.
 * - intervalMs === null  → disable autosync (autosyncEnabled=false, nextScheduledAt=null)
 * - intervalMs === number → enable autosync with fresh nextScheduledAt
 */
export async function setScheduleInterval(
  userId: string,
  credentialId: string,
  intervalMs: number | null,
): Promise<void> {
  assertAdminIntegrations(userId);

  const cred = await db.integrationCredential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true },
  });
  if (!cred) {
    throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
  }

  if (intervalMs === null) {
    await db.integrationCredential.update({
      where: { id: credentialId },
      data: {
        autosyncEnabled: false,
        scheduleIntervalMs: null,
        nextScheduledAt: null,
      },
    });
  } else {
    await db.integrationCredential.update({
      where: { id: credentialId },
      data: {
        autosyncEnabled: true,
        scheduleIntervalMs: intervalMs,
        nextScheduledAt: new Date(Date.now() + intervalMs),
      },
    });
  }
}
