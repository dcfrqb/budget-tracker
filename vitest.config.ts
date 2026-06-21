import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["vitest.setup.unit.ts"],
          globals: true,
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "."),
          },
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: [
            "tests/integration/**/*.test.ts",
            "tests/smoke/**/*.test.ts",
          ],
          setupFiles: ["vitest.setup.integration.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          globals: true,
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
          pool: "forks",
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "."),
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
