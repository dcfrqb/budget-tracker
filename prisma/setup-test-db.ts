#!/usr/bin/env tsx
/**
 * setup-test-db.ts
 *
 * Creates the test database (budget_tracker_test) and runs Prisma migrations.
 * Safe to run repeatedly — no-op if DB already exists.
 *
 * Usage: tsx prisma/setup-test-db.ts
 *
 * This script:
 * 1. Loads .env.test to read TEST DATABASE_URL
 * 2. Guards against non-localhost hosts or non-_test databases (safety check)
 * 3. Connects to maintenance DB (postgres) to CREATE DATABASE if missing
 * 4. Runs 'prisma migrate deploy' against the test DB
 */

import "dotenv/config";
import { execSync } from "child_process";
import { URL } from "url";
import fs from "fs";
import path from "path";
import pg from "pg";

// ──────────────────────────────────────────────────────────────────────────
// Load .env.test explicitly
// ──────────────────────────────────────────────────────────────────────────

import dotenv from "dotenv";

const testEnvPath = path.resolve(process.cwd(), ".env.test");
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
} else {
  console.warn(`⚠️  .env.test not found at ${testEnvPath}`);
  console.warn(
    "   Falling back to process.env.DATABASE_URL (if set). Copy .env.test.example to .env.test if needed."
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Safety guards: localhost-only + _test database
// ──────────────────────────────────────────────────────────────────────────

function assertTestDatabase(url: string) {
  try {
    const parsed = new URL(url);

    // Only localhost/127.0.0.1/[::1]
    const host = parsed.hostname || "";
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
      throw new Error(
        `FAIL: Test DATABASE_URL host must be localhost, got: ${host}`
      );
    }

    // Only _test databases
    const dbName = parsed.pathname.split("/")[1];
    if (!dbName || !dbName.endsWith("_test")) {
      throw new Error(
        `FAIL: Test DATABASE_URL database name must end with '_test', got: ${dbName}`
      );
    }

    console.log(`✓ Safety guards passed: host=${host}, db=${dbName}`);
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message);
    }
    process.exit(1);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Create test DB using pg client
// ──────────────────────────────────────────────────────────────────────────

async function createTestDatabaseIfMissing() {
  const testDbUrl = process.env.DATABASE_URL;
  if (!testDbUrl) {
    console.error("ERROR: DATABASE_URL is not set in .env.test or environment");
    process.exit(1);
  }

  assertTestDatabase(testDbUrl);

  const parsed = new URL(testDbUrl);
  const host = parsed.hostname || "localhost";
  const port = parseInt(parsed.port || "5432");
  const user = parsed.username || "postgres";
  const password = parsed.password || "";
  const dbName = parsed.pathname.split("/")[1];

  console.log(`Creating test database ${dbName} if missing...`);

  const client = new pg.Client({
    host,
    port,
    user,
    password: password || undefined,
    database: "postgres", // Connect to maintenance DB
  });

  try {
    await client.connect();

    // Try to create database; ignore error if it already exists
    try {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✓ Created new test database: ${dbName}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) {
        console.log(`✓ Test database already exists: ${dbName}`);
      } else {
        throw err;
      }
    }

    await client.end();
  } catch (err) {
    console.error("ERROR creating test database:");
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Run prisma migrate deploy
// ──────────────────────────────────────────────────────────────────────────

function runPrismaMigrations() {
  console.log("\nRunning 'prisma migrate deploy' against test database...");

  try {
    const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL };
    execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
    console.log("✓ Prisma migrations applied successfully");
  } catch (err) {
    console.error("ERROR: prisma migrate deploy failed");
    process.exit(1);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await createTestDatabaseIfMissing();
    runPrismaMigrations();
    console.log("\n✓ Test database setup complete!");
  } catch (err) {
    console.error("\n✗ Setup failed:", err);
    process.exit(1);
  }
}

main();
