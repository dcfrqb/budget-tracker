import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";
import { assertTestDatabase } from "../fixtures/guard";

export async function setup() {
  // Load .env.test if present (local dev). In CI, DATABASE_URL comes from
  // the workflow environment — no .env.test file is needed.
  const testEnvPath = path.resolve(process.cwd(), ".env.test");
  if (fs.existsSync(testEnvPath)) {
    dotenv.config({ path: testEnvPath, override: true });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL is not set. " +
        "Copy .env.test.example to .env.test (local dev), " +
        "or set DATABASE_URL in the CI environment."
    );
  }

  // Hard-fail if not a test database
  assertTestDatabase(dbUrl);

  // Run db:test:setup — creates the DB and deploys migrations (idempotent)
  console.log("[global-setup] Running db:test:setup...");
  execSync("npm run db:test:setup", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
  console.log("[global-setup] Test DB ready.");
}
