/**
 * fixtures/factory.ts
 *
 * Test database setup and fixtures factory.
 *
 * Responsibilities:
 * 1. truncateAll(db) — TRUNCATE all app tables for test isolation
 * 2. seedReferenceData(db) — Insert minimal reference data tests assume exists
 *    (default user, base currency, exchange rates)
 */

import { PrismaClient, Prisma } from "@prisma/client";

// Single source of truth for the prod-safety guard — do NOT inline a copy here.
import { assertTestDatabase } from "./guard";

// ──────────────────────────────────────────────────────────────────────────
// truncateAll: TRUNCATE all app tables with CASCADE
// ──────────────────────────────────────────────────────────────────────────

export async function truncateAll(db: PrismaClient) {
  // Guard against accidental truncation of non-test databases
  const url = process.env.DATABASE_URL || "";
  assertTestDatabase(url);

  // Fetch all tables from information_schema, excluding Prisma's migration table
  const result = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    ORDER BY tablename
  `;

  const tableNames = result.map((row) => row.tablename);

  if (tableNames.length === 0) {
    console.log("No tables to truncate (schema may be empty)");
    return;
  }

  console.log(`Truncating ${tableNames.length} tables...`);

  // Build and execute TRUNCATE with CASCADE RESTART IDENTITY
  const truncateStmt = tableNames
    .map((name) => `TRUNCATE TABLE "${name}" RESTART IDENTITY CASCADE`)
    .join("; ");

  await db.$executeRawUnsafe(truncateStmt);
  console.log("✓ All tables truncated");
}

// ──────────────────────────────────────────────────────────────────────────
// seedReferenceData: Insert minimal reference data for tests
// ──────────────────────────────────────────────────────────────────────────

export async function seedReferenceData(db: PrismaClient) {
  // TODO: Phase 2 must extend this with:
  // - Complete set of Category records (INCOME, EXPENSE, TRANSFER, LOAN_PAYMENT, etc.)
  //   and their associations to default user
  // - Additional currencies beyond RUB/USD (EUR, GEL, USDT, BTC, etc.)
  // - Default BudgetSettings for default user (3 budget modes + category limits)
  // - Initial subscriptions or obligations if tests require them

  const DEFAULT_USER_ID = "usr_default_single";
  const now = new Date();

  // Create default user
  console.log("Seeding reference data...");

  await db.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: {
      id: DEFAULT_USER_ID,
      email: "test-default@budget-tracker.local",
      name: "Test User (Default)",
      timezone: "Europe/Moscow",
      onboardedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });
  console.log(`✓ Default user: ${DEFAULT_USER_ID}`);

  // Create base currencies (RUB, USD)
  await db.currency.upsert({
    where: { code: "RUB" },
    update: {},
    create: {
      code: "RUB",
      name: "Russian Ruble",
      symbol: "₽",
      decimals: 2,
    },
  });

  await db.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: {
      code: "USD",
      name: "US Dollar",
      symbol: "$",
      decimals: 2,
    },
  });
  console.log("✓ Base currencies (RUB, USD)");

  // Create baseline exchange rate: RUB→USD
  // TODO: Phase 2 — make this dynamic from a fixture data file or env var.
  // For now, use a fixed rate (e.g., 1 USD = 100 RUB as a round number for testing).
  const existingRate = await db.exchangeRate.findFirst({
    where: { fromCcy: "RUB", toCcy: "USD" },
    orderBy: { recordedAt: "desc" },
    take: 1,
  });

  if (!existingRate) {
    await db.exchangeRate.create({
      data: {
        fromCcy: "RUB",
        toCcy: "USD",
        rate: new Prisma.Decimal("0.01"), // 1 RUB = 0.01 USD (100 RUB = 1 USD)
        recordedAt: now,
      },
    });
    console.log("✓ Exchange rate RUB→USD (1 RUB = 0.01 USD)");
  }

  console.log("✓ Reference data seeded");
}

// ──────────────────────────────────────────────────────────────────────────
// Export for global-setup or individual test hooks
// ──────────────────────────────────────────────────────────────────────────

export { PrismaClient };
