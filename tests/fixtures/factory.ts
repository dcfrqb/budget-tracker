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
// Use the real constant so seed (factory) and builders never desync on the id.
import { DEFAULT_USER_ID } from "@/lib/constants";

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
  // Phase 2 Extension: Full baseline for dashboard/analytics/wallet functions
  // - Default user (single-user mode)
  // - Currencies: RUB (base), USD, EUR, GEL, USDT, BTC
  // - Exchange rates: RUB/USD (100:1), EUR/RUB (110:1), etc.
  // - Full Category set (INCOME, EXPENSE) with limits and essential flags
  // - Default BudgetSettings with 3 budget modes and category limits

  const now = new Date();

  // ──── DEFAULT USER ────
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

  // ──── CURRENCIES (all supported in constants.ts) ────
  const CURRENCIES_TO_SEED = [
    { code: "RUB", name: "Russian Ruble", symbol: "₽", decimals: 2 },
    { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
    { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
    { code: "GEL", name: "Georgian Lari", symbol: "₾", decimals: 2 },
    { code: "USDT", name: "Tether", symbol: "₮", decimals: 6 },
    { code: "USDC", name: "USD Coin", symbol: "USDC", decimals: 6 },
    { code: "BTC", name: "Bitcoin", symbol: "₿", decimals: 8 },
  ];

  for (const ccy of CURRENCIES_TO_SEED) {
    await db.currency.upsert({
      where: { code: ccy.code },
      update: {},
      create: ccy,
    });
  }
  console.log(`✓ Currencies (${CURRENCIES_TO_SEED.map((c) => c.code).join(", ")})`);

  // ──── EXCHANGE RATES (deterministic, round numbers for testing) ────
  // Baseline rates: 1 USD = 100 RUB; 1 EUR = 110 RUB
  // Also inverse and cross-rates for USD base testing
  const RATES_TO_SEED = [
    { from: "RUB", to: "USD", rate: "0.01" }, // 1 RUB = 0.01 USD (100 RUB = 1 USD)
    { from: "USD", to: "RUB", rate: "100" }, // 1 USD = 100 RUB
    { from: "EUR", to: "RUB", rate: "110" }, // 1 EUR = 110 RUB
    { from: "RUB", to: "EUR", rate: "0.00909090909" }, // ~1/110
    { from: "USD", to: "EUR", rate: "0.92" }, // 1 USD = 0.92 EUR
    { from: "EUR", to: "USD", rate: "1.09" }, // 1 EUR = 1.09 USD
    { from: "GEL", to: "RUB", rate: "3.4" }, // 1 GEL = 3.4 RUB
    { from: "USDT", to: "USD", rate: "1" }, // 1 USDT = 1 USD
    { from: "BTC", to: "USD", rate: "42500" }, // 1 BTC = 42500 USD
  ];

  for (const r of RATES_TO_SEED) {
    const existing = await db.exchangeRate.findFirst({
      where: { fromCcy: r.from, toCcy: r.to },
      orderBy: { recordedAt: "desc" },
      take: 1,
    });
    if (!existing) {
      await db.exchangeRate.create({
        data: {
          fromCcy: r.from,
          toCcy: r.to,
          rate: new Prisma.Decimal(r.rate),
          recordedAt: now,
        },
      });
    }
  }
  console.log(`✓ Exchange rates (${RATES_TO_SEED.length} pairs)`);

  // ──── CATEGORIES (expense-focused: used by dashboard, analytics, wallet) ────
  // Structure: INCOME (simple) + EXPENSE (with subcategories and essential flags)
  // Limits are in primary currency (RUB). MODE_LIMIT_MULTIPLIER: ECONOMY=80%, NORMAL=100%, FREE=120%
  // All limits are baseline (NORMAL), others computed by UI using multiplier.

  const INCOME_CATEGORIES = [
    { name: "Salary", icon: "💼" },
    { name: "Freelance", icon: "🎯" },
    { name: "Other Income", icon: "➕" },
  ];

  const EXPENSE_CATEGORIES = [
    // Essential (cannot be cut)
    { name: "Rent", icon: "🏠", essential: true, limitNormal: "50000" },
    { name: "Utilities", icon: "⚡", essential: true, limitNormal: "10000" },
    { name: "Groceries", icon: "🛒", essential: true, limitNormal: "30000" },
    // Discretionary (can be reduced)
    { name: "Dining Out", icon: "🍽", essential: false, limitNormal: "15000" },
    { name: "Entertainment", icon: "🎬", essential: false, limitNormal: "10000" },
    { name: "Transport", icon: "🚗", essential: true, limitNormal: "8000" },
    { name: "Shopping", icon: "🛍", essential: false, limitNormal: "20000" },
    { name: "Subscriptions", icon: "📺", essential: false, limitNormal: "5000" },
    { name: "Healthcare", icon: "⚕", essential: true, limitNormal: "12000" },
    { name: "Other", icon: "📌", essential: false, limitNormal: "10000" },
  ];

  for (const cat of INCOME_CATEGORIES) {
    const existing = await db.category.findFirst({
      where: { userId: DEFAULT_USER_ID, name: cat.name, kind: "INCOME" },
    });
    if (!existing) {
      await db.category.create({
        data: {
          userId: DEFAULT_USER_ID,
          name: cat.name,
          kind: "INCOME",
          icon: cat.icon,
          essential: false,
          sortOrder: INCOME_CATEGORIES.indexOf(cat),
        },
      });
    }
  }

  for (const cat of EXPENSE_CATEGORIES) {
    const existing = await db.category.findFirst({
      where: { userId: DEFAULT_USER_ID, name: cat.name, kind: "EXPENSE" },
    });
    if (!existing) {
      await db.category.create({
        data: {
          userId: DEFAULT_USER_ID,
          name: cat.name,
          kind: "EXPENSE",
          icon: cat.icon,
          essential: cat.essential,
          limitNormal: cat.limitNormal ? new Prisma.Decimal(cat.limitNormal) : null,
          limitEconomy: cat.limitNormal ? new Prisma.Decimal(cat.limitNormal).times(0.8) : null,
          limitFree: cat.limitNormal ? new Prisma.Decimal(cat.limitNormal).times(1.2) : null,
          sortOrder: EXPENSE_CATEGORIES.indexOf(cat),
        },
      });
    }
  }
  console.log(`✓ Categories (${INCOME_CATEGORIES.length} income + ${EXPENSE_CATEGORIES.length} expense)`);

  // ──── BUDGET SETTINGS (3 modes with primary currency RUB) ────
  const existingSettings = await db.budgetSettings.findUnique({
    where: { userId: DEFAULT_USER_ID },
  });

  if (!existingSettings) {
    await db.budgetSettings.create({
      data: {
        userId: DEFAULT_USER_ID,
        activeMode: "NORMAL",
        primaryCurrencyCode: "RUB",
        shownFxPairs: ["USD/RUB", "EUR/RUB"],
        defaultPeriod: "3m",
        autosyncIntervalMs: null,
      },
    });
  }
  console.log("✓ BudgetSettings (NORMAL mode, RUB base)");

  console.log("✓ Reference data seeded (baseline complete)");
}

// ──────────────────────────────────────────────────────────────────────────
// Export for global-setup or individual test hooks
// ──────────────────────────────────────────────────────────────────────────

export { PrismaClient };
