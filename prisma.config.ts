import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: URL для migrate задаётся здесь, не в schema.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
