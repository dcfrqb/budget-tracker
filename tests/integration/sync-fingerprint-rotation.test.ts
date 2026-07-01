/**
 * integration/sync-fingerprint-rotation.test.ts
 *
 * Regression guard for the externalId-rotation deduplication in syncCredential.
 *
 * Tinkoff rotates an operation's externalId when it moves from authorization to
 * settled, and operationTime can shift by a few seconds in the process. The
 * fingerprint dedupe must recognise the rotated row as the same physical op and
 * UPDATE the existing record instead of inserting a duplicate.
 *
 * The fix widened the fingerprint occurredAt match from exact equality to a
 * tolerance window. That is only safe because the match additionally requires the
 * candidate's externalId to have VANISHED from the current feed — otherwise two
 * genuine concurrent same-amount ops (e.g. several identical small transfers in
 * one payload) would be wrongly collapsed into one.
 *
 * Case 1 — rotation across two syncs collapses to a single row (externalId updated).
 * Case 2 — two genuine concurrent same-amount ops in ONE sync are BOTH kept.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ImportRow } from "@/lib/import/types";

// Hoisted mutable holder: the mock adapter returns whatever rows the test sets.
const harness = vi.hoisted(() => ({ rows: [] as ImportRow[] }));

vi.mock("@/lib/integrations/registry", () => {
  const adapter = {
    id: "mock-rotate",
    displayName: "Mock Rotate",
    category: "api-reverse" as const,
    supports: {
      login: false,
      otp: false,
      fetchTransactions: true,
      parseFile: false,
      listExternalAccounts: false,
    },
    scheduling: { autosyncEnabled: false, defaultIntervalMs: 0, minIntervalMs: 0 },
    fetchTransactions: async () => harness.rows,
  };
  return {
    getAdapter: (id: string) => (id === "mock-rotate" ? adapter : null),
    getAdapters: () => [adapter],
  };
});

import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { makeAccount } from "@/tests/fixtures/builders";
import { syncCredential } from "@/lib/data/_mutations/integrations";

function row(overrides: Partial<ImportRow> & { externalId: string; occurredAt: string }): ImportRow {
  return {
    amount: "100.00",
    currencyCode: "RUB",
    kind: "EXPENSE",
    direction: "out",
    description: "Георгий Г.",
    raw: {},
    ...overrides,
  };
}

async function makeCredential(): Promise<string> {
  // encryptedPayload is required; a garbage value makes decrypt() throw, which
  // syncCredential swallows into secrets = {} — exactly what we want (no real key).
  const cred = await db.integrationCredential.create({
    data: {
      userId: DEFAULT_USER_ID,
      adapterId: "mock-rotate",
      status: "CONNECTED",
      encryptedPayload: "x",
      encryptionIv: "x",
      encryptionTag: "x",
    },
    select: { id: true },
  });
  return cred.id;
}

describe("syncCredential – externalId rotation fingerprint dedupe", () => {
  beforeEach(async () => {
    process.env.ADMIN_INTEGRATIONS = "true";
    await makeAccount(db, { name: "Sync Account", currencyCode: "RUB" });
  });

  it("collapses a rotated op (new externalId + 1s time shift) into the existing row", async () => {
    const credId = await makeCredential();
    const base = new Date(Date.now() - 5 * 60_000); // 5 min ago, safely inside range

    // Sync 1 — authorization id.
    harness.rows = [row({ externalId: "OLD-1", occurredAt: base.toISOString() })];
    await syncCredential(DEFAULT_USER_ID, credId);

    let txns = await db.transaction.findMany({
      where: { userId: DEFAULT_USER_ID, deletedAt: null },
      select: { externalId: true },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].externalId).toBe("OLD-1");

    // Sync 2 — same physical op, rotated id, occurredAt shifted by 1 second.
    harness.rows = [
      row({ externalId: "NEW-1", occurredAt: new Date(base.getTime() + 1000).toISOString() }),
    ];
    await syncCredential(DEFAULT_USER_ID, credId);

    txns = await db.transaction.findMany({
      where: { userId: DEFAULT_USER_ID, deletedAt: null },
      select: { externalId: true },
    });
    expect(txns).toHaveLength(1); // no duplicate
    expect(txns[0].externalId).toBe("NEW-1"); // externalId reconciled to the settled id
  });

  it("keeps two genuine concurrent same-amount ops from a single sync", async () => {
    const credId = await makeCredential();
    const base = new Date(Date.now() - 5 * 60_000);

    // Both ids present in the SAME payload → not a rotation; must both survive.
    harness.rows = [
      row({ externalId: "A", occurredAt: base.toISOString(), amount: "67.67", description: "Иван К.", kind: "INCOME", direction: "in" }),
      row({ externalId: "B", occurredAt: new Date(base.getTime() + 1000).toISOString(), amount: "67.67", description: "Иван К.", kind: "INCOME", direction: "in" }),
    ];
    await syncCredential(DEFAULT_USER_ID, credId);

    const txns = await db.transaction.findMany({
      where: { userId: DEFAULT_USER_ID, deletedAt: null },
      select: { externalId: true },
      orderBy: { externalId: "asc" },
    });
    expect(txns.map((t) => t.externalId)).toEqual(["A", "B"]);
  });
});
