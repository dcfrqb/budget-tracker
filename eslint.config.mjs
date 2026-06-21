import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Global ignores
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "prisma/migrations/**",
      "dist/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
    ],
  },

  // TypeScript source files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        // No project:true — type-aware rules need full type info and are slower.
        // Enable once the codebase is clean.
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      // ── Correctness (error) ──────────────────────────────────────────────
      "no-undef": "off", // TS handles this better

      // Downgraded to warn: the existing codebase has ~64 pre-existing unused
      // vars that would make CI red before any new tests are written.
      // Promote back to "error" once the baseline is clean.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description" },
      ],

      // React hooks rules (existing code uses eslint-disable for these)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "no-console": "off", // budget tracker uses console.log in data layer

      // ── Style (warn) — don't fail CI on pre-existing noise ───────────────
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
    },
  },

  // Prettier overrides — must be last to win
  prettierConfig,
];
