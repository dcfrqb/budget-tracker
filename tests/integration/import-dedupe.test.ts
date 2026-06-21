/**
 * integration/import-dedupe.test.ts
 *
 * DB-level uniqueness invariant for import deduplication.
 *
 * Schema constraint (schema.prisma:399):
 *   @@unique([accountId, source, externalId], name: "importDedupe")
 *
 * NOTE: The constraint only fires when BOTH source AND externalId are non-null.
 * Prisma unique constraints with nullable columns follow SQL semantics:
 * NULL values are not considered equal, so two rows with the same accountId/source
 * but NULL externalId do NOT violate the constraint.
 *
 * This test file:
 *   1. Asserts that inserting two rows with the same (accountId, source, externalId)
 *      violates the unique constraint (DB rejects the duplicate).
 *   2. Asserts that rows with NULL externalId do NOT trigger the constraint
 *      (multiple imports without externalId are allowed for the same account+source).
 *   3. Asserts that the same externalId is allowed on DIFFERENT accounts.
 *   4. Asserts that the same externalId is allowed with DIFFERENT sources.
 *
 * The pure findDuplicates logic is already unit-tested in tests/unit/dedupe.test.ts.
 * Here we focus on the DB-level invariant only.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { makeAccount } from "@/tests/fixtures/builders";

const NOW = new Date("2024-06-15T12:00:00.000Z");

async function insertTxnWithExternalId(opts: {
  accountId: string;
  source: string | null;
  externalId: string | null;
  amount?: string;
  name?: string;
}) {
  return db.transaction.create({
    data: {
      userId: DEFAULT_USER_ID,
      accountId: opts.accountId,
      kind: TransactionKind.EXPENSE,
      status: TransactionStatus.DONE,
      amount: new Prisma.Decimal(opts.amount ?? "100"),
      currencyCode: "RUB",
      occurredAt: NOW,
      name: opts.name ?? "Import Txn",
      source: opts.source,
      externalId: opts.externalId,
    },
    select: { id: true, externalId: true, source: true },
  });
}

describe("import dedupe – DB unique constraint (accountId, source, externalId)", () => {
  let accId: string;
  let accId2: string;

  beforeEach(async () => {
    const acc = await makeAccount(db, { name: "Import Account", currencyCode: "RUB" });
    const acc2 = await makeAccount(db, { name: "Other Account", currencyCode: "RUB" });
    accId = acc.id;
    accId2 = acc2.id;
  });

  it("rejects duplicate (accountId, source, externalId) — DB throws unique constraint violation", async () => {
    // First insert succeeds
    await insertTxnWithExternalId({
      accountId: accId,
      source: "tinkoff",
      externalId: "TXN-001",
    });

    // Second insert with same (accountId, source, externalId) should fail
    await expect(
      insertTxnWithExternalId({
        accountId: accId,
        source: "tinkoff",
        externalId: "TXN-001",
      })
    ).rejects.toThrow(); // Prisma throws PrismaClientKnownRequestError P2002
  });

  it("the thrown error is a unique constraint violation (P2002)", async () => {
    await insertTxnWithExternalId({
      accountId: accId,
      source: "tinkoff",
      externalId: "TXN-002",
    });

    let thrownError: unknown;
    try {
      await insertTxnWithExternalId({
        accountId: accId,
        source: "tinkoff",
        externalId: "TXN-002",
      });
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeDefined();
    // Prisma P2002: Unique constraint failed
    expect((thrownError as { code?: string }).code).toBe("P2002");
  });

  it("allows NULL externalId to appear multiple times for same accountId+source (SQL NULL ≠ NULL)", async () => {
    // Both inserts have null externalId — should NOT trigger unique constraint
    const t1 = await insertTxnWithExternalId({
      accountId: accId,
      source: "tinkoff",
      externalId: null,
      name: "Import row 1",
    });
    const t2 = await insertTxnWithExternalId({
      accountId: accId,
      source: "tinkoff",
      externalId: null,
      name: "Import row 2",
    });

    expect(t1.id).toBeTruthy();
    expect(t2.id).toBeTruthy();
    expect(t1.id).not.toBe(t2.id);
  });

  it("allows same externalId on a DIFFERENT account (constraint is per-account)", async () => {
    // TXN-003 on acc1
    await insertTxnWithExternalId({
      accountId: accId,
      source: "tinkoff",
      externalId: "TXN-003",
    });

    // Same externalId on acc2 — different account, should be allowed
    const t2 = await insertTxnWithExternalId({
      accountId: accId2,
      source: "tinkoff",
      externalId: "TXN-003",
    });

    expect(t2.id).toBeTruthy();
  });

  it("allows same externalId with a DIFFERENT source (constraint includes source)", async () => {
    // TXN-004 via tinkoff
    await insertTxnWithExternalId({
      accountId: accId,
      source: "tinkoff",
      externalId: "TXN-004",
    });

    // Same externalId but different source — should be allowed
    const t2 = await insertTxnWithExternalId({
      accountId: accId,
      source: "sber",
      externalId: "TXN-004",
    });

    expect(t2.id).toBeTruthy();
  });

  it("allows same externalId when source is NULL (NULL not equal to a non-NULL source)", async () => {
    await insertTxnWithExternalId({
      accountId: accId,
      source: "tinkoff",
      externalId: "TXN-005",
    });

    // Same externalId, same accountId, but source=null — should be allowed
    const t2 = await insertTxnWithExternalId({
      accountId: accId,
      source: null,
      externalId: "TXN-005",
    });

    expect(t2.id).toBeTruthy();
  });
});
