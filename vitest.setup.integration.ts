import { vi, beforeEach, afterAll, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Stub next/cache — server modules call revalidatePath, which requires Next.js runtime.
// vi.mock is hoisted before any imports, so this stub is in place before @/lib/db loads.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

// Stub server-only guard module
vi.mock("server-only", () => ({}));

// Load .env.test early — DATABASE_URL must be set before PrismaClient is constructed.
// vi.mock is hoisted above this, but dotenv.config runs before beforeAll hooks.
const testEnvPath = path.resolve(process.cwd(), ".env.test");
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
}

// Lazy-loaded once the env is guaranteed set
let db: import("@prisma/client").PrismaClient;
let truncateAll: (db: import("@prisma/client").PrismaClient) => Promise<void>;
let seedReferenceData: (
  db: import("@prisma/client").PrismaClient
) => Promise<void>;

beforeAll(async () => {
  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const factoryMod = await import("@/tests/fixtures/factory");
  truncateAll = factoryMod.truncateAll;
  seedReferenceData = factoryMod.seedReferenceData;
});

// Before each test: truncate all tables then seed reference data.
// Order: truncate first (clean slate), then seed (so every test starts from
// a known baseline). Tests that need additional data create it themselves.
beforeEach(async () => {
  if (db && truncateAll && seedReferenceData) {
    await truncateAll(db);
    await seedReferenceData(db);
  }
});

afterAll(async () => {
  if (db) {
    await db.$disconnect();
  }
});
