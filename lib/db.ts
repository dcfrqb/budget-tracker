import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  // eslint-disable-next-line no-var
  var __bdg_prisma: PrismaClient | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export const db = globalThis.__bdg_prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__bdg_prisma = db;
}
