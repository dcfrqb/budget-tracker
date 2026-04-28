import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Validation schemas for integration actions and API routes.
// Used in both server actions (actions.ts) and route handlers.
// ─────────────────────────────────────────────────────────────

// Re-usable cuid validator (loose — Prisma cuid format).
const zCuid = z.string().cuid();

// ── Connect ──────────────────────────────────────────────────

/**
 * Schema for connectAdapterAction.
 * Tinkoff-retail requires a Russian phone number.
 * Other adapters: only adapterId validated; rest fields pass through via .passthrough().
 */
export const connectTinkoffRetailSchema = z.object({
  adapterId: z.literal("tinkoff-retail"),
  // Accepts +7XXXXXXXXXX, 8XXXXXXXXXX, or 7XXXXXXXXXX — adapter normalizes via normalizeRuPhone.
  username: z
    .string()
    .regex(/^(?:\+7|8|7)\d{10}$/, "Phone must be +7/8/7 followed by 10 digits"),
  lkPassword: z.string().min(1, "password required"),
  password: z
    .string()
    .regex(/^\d{4}$/, "PIN must be 4 digits"),
  displayLabel: z.string().max(120).optional(),
});

/** Generic connect schema: any adapterId, any additional string fields. */
export const connectGenericSchema = z.object({
  adapterId: z.string().min(1).max(80),
  displayLabel: z.string().max(120).optional(),
});

/** Union: strict for known adapters, generic fallback. */
export const connectInputSchema = z.discriminatedUnion("adapterId", [
  connectTinkoffRetailSchema,
]).or(connectGenericSchema);

// ── Login ─────────────────────────────────────────────────────

/**
 * Tinkoff-retail login: credentialId + password (PIN/password field).
 * "username" field carries the phone — validated at connect time, not repeated here.
 */
export const loginTinkoffRetailSchema = z.object({
  adapterId: z.literal("tinkoff-retail"),
  credentialId: zCuid,
  password: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
});

/** Generic login schema. */
export const loginGenericSchema = z.object({
  credentialId: zCuid,
  password: z.string().min(1).max(200),
  // Optional at the boundary — adapter layer enforces per-adapter requirement.
  lkPassword: z.string().optional(),
});

export const loginInputSchema = loginGenericSchema;

// ── OTP ──────────────────────────────────────────────────────

export const submitOtpSchema = z.object({
  credentialId: zCuid,
  code: z
    .string()
    .regex(/^\d{4,8}$/, "OTP must be 4-8 digits"),
});

// ── Sync body (API route POST body) ──────────────────────────

const MAX_SYNC_WINDOW_DAYS = 90;

export const syncBodySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    accountId: zCuid.optional(),
  })
  .refine(
    (v) => {
      if (v.from && v.to) {
        const diffMs = new Date(v.to).getTime() - new Date(v.from).getTime();
        return diffMs <= MAX_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      }
      return true;
    },
    { message: `Sync window must be ≤ ${MAX_SYNC_WINDOW_DAYS} days` },
  )
  .refine(
    (v) => {
      if (v.from && v.to) {
        return new Date(v.from) <= new Date(v.to);
      }
      return true;
    },
    { message: "from must be before to" },
  );

// ── Account link mutations ────────────────────────────────────

export const linkExternalAccountSchema = z.object({
  credentialId: zCuid,
  externalAccountId: z.string().min(1).max(64),
  accountId: zCuid,
  label: z.string().max(120).optional(),
});

export const unlinkExternalAccountSchema = z.object({
  credentialId: zCuid,
  externalAccountId: z.string().min(1).max(64),
});

export const reloginSchema = z.object({
  credentialId: zCuid,
  // Loose — strict normalize happens in adapter via normalizeRuPhone.
  phone: z.string().min(11).max(20),
  // Optional at the schema layer — per-adapter requirement is enforced inside
  // the adapter (tinkoff-retail returns lk_password_required if missing).
  // Generic adapters that don't need an LK password pass undefined or "".
  lkPassword: z.string().optional(),
  password: z.string().min(1).max(200),
});

// ── Create account and link ───────────────────────────────────

export const createAccountAndLinkSchema = z.object({
  credentialId: zCuid,
  externalAccountId: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  currencyCode: z.string().min(3).max(10),
  accountType: z.string().min(1).max(64),
});

export type CreateAccountAndLinkInput = z.infer<typeof createAccountAndLinkSchema>;

// ── Disconnect / Delete ───────────────────────────────────────

export const disconnectInputSchema = z.object({
  credentialId: zCuid,
});

export const deleteCredentialSchema = z.object({
  credentialId: zCuid,
});

// ── Validation helper for server actions ─────────────────────
// Returns a structured error safe for client consumption —
// only field names, never raw Zod messages (which may reflect input).

export type ValidationFailure = {
  ok: false;
  error: "validation_failed";
  issues: string[];
};

export function toValidationFailure(
  error: z.ZodError,
): ValidationFailure {
  return {
    ok: false,
    error: "validation_failed",
    // Only expose field paths, not the raw error messages.
    issues: error.issues.map((i) => i.path.join(".")),
  };
}
