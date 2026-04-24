// ─────────────────────────────────────────────────────────────
// i18n types — no external dependencies
// ─────────────────────────────────────────────────────────────

export type Locale = "ru" | "en";
export const DEFAULT_LOCALE: Locale = "ru";

/** Recursive string-only dictionary */
export type Dict = { [key: string]: string | Dict };

/** Interpolation variables */
export type TVars = Record<string, string | number>;

/** Options for the t() function */
export type TOptions = { vars?: TVars };

// ─────────────────────────────────────────────────────────────
// PathsOf<T> — compile-time dot-path extraction
// Produces union of all dot-separated paths that lead to string leaves.
// ─────────────────────────────────────────────────────────────

type Leaves<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : T extends Dict
  ? {
      [K in keyof T & string]: Leaves<
        T[K],
        Prefix extends "" ? K : `${Prefix}.${K}`
      >;
    }[keyof T & string]
  : never;

export type PathsOf<T extends Dict> = Leaves<T>;
