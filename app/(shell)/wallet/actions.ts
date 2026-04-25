"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import { accountCreateSchema, accountUpdateSchema, type AccountCreateInput } from "@/lib/validation/account";
import { z } from "zod";
import { zMoney, zCurrencyCode } from "@/lib/validation/shared";
import { AccountKind, InstitutionKind } from "@prisma/client";
import {
  createAccount,
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  deleteAccount,
} from "@/lib/data/_mutations/accounts";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────
// Helper: null out fields that don't apply to a given kind
// ─────────────────────────────────────────────────────────────

function stripOrphanFields<T extends Partial<AccountCreateInput>>(input: T): T {
  const kind = input.kind;
  if (kind === AccountKind.CREDIT) {
    return {
      ...input,
      annualRatePct: null,
      savingsCapitalization: null,
      withdrawalLimit: null,
    };
  }
  if (kind === AccountKind.SAVINGS) {
    return {
      ...input,
      creditRatePct: null,
      creditLimit: null,
      gracePeriodDays: null,
      statementDay: null,
      minPaymentPercent: null,
      minPaymentFixed: null,
    };
  }
  // CARD / CRYPTO / LOAN / CASH: clear all conditional fields
  return {
    ...input,
    annualRatePct: null,
    savingsCapitalization: null,
    withdrawalLimit: null,
    creditRatePct: null,
    creditLimit: null,
    gracePeriodDays: null,
    statementDay: null,
    minPaymentPercent: null,
    minPaymentFixed: null,
  };
}

// ─────────────────────────────────────────────────────────────
// Create account (optionally with inline institution)
// ─────────────────────────────────────────────────────────────

const createAccountWithInstitutionSchema = accountCreateSchema.extend({
  newInstitutionName: z.string().min(1).max(120).optional(),
  newInstitutionKind: z.nativeEnum(InstitutionKind).optional(),
});

export const createAccountAction = withUserAction(
  createAccountWithInstitutionSchema,
  async (userId, input) => {
    let institutionId = input.institutionId;

    // If a new institution is being created inline
    if (!institutionId && input.newInstitutionName) {
      const institution = await db.institution.create({
        data: {
          userId,
          name: input.newInstitutionName,
          kind: input.newInstitutionKind ?? InstitutionKind.BANK,
        },
      });
      institutionId = institution.id;
    }

    const { newInstitutionName: _a, newInstitutionKind: _b, ...accountData } = input;
    const cleaned = stripOrphanFields({ ...accountData, institutionId });
    const account = await createAccount(userId, cleaned);
    revalidateTag("accounts", "default");
    revalidateTag("institutions", "default");
    revalidatePath("/", "layout");
    return account;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateAccountAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = accountUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { ok: false as const, fieldErrors };
  }
  try {
    const cleaned = parsed.data.kind ? stripOrphanFields(parsed.data) : parsed.data;
    const account = await updateAccount(userId, id, cleaned);
    revalidateTag("accounts", "default");
    revalidatePath("/", "layout");
    return actionOk(account);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Archive / Unarchive
// ─────────────────────────────────────────────────────────────

export async function archiveAccountAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const account = await archiveAccount(userId, id);
    revalidateTag("accounts", "default");
    revalidatePath("/", "layout");
    return actionOk(account);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

export async function unarchiveAccountAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const account = await unarchiveAccount(userId, id);
    revalidateTag("accounts", "default");
    revalidatePath("/", "layout");
    return actionOk(account);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

export async function deleteAccountAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    await deleteAccount(userId, id);
    revalidateTag("accounts", "default");
    revalidatePath("/", "layout");
    return actionOk({ id });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "CONFLICT") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Create CASH location (cash-stash section, D8)
// includeInAnalytics defaults to false per design vision
// ─────────────────────────────────────────────────────────────

const createCashLocationSchema = z.object({
  location: z.string().min(1).max(120),
  currencyCode: zCurrencyCode,
  balance: zMoney.optional(),
});

export const createCashLocationAction = withUserAction(
  createCashLocationSchema,
  async (userId, input) => {
    // Find or create the CASH institution for this user
    let cashInstitution = await db.institution.findFirst({
      where: { userId, kind: InstitutionKind.CASH },
      select: { id: true },
    });
    if (!cashInstitution) {
      cashInstitution = await db.institution.create({
        data: { userId, name: "Наличные", kind: InstitutionKind.CASH },
      });
    }
    const account = await db.account.create({
      data: {
        userId,
        institutionId: cashInstitution.id,
        kind: AccountKind.CASH,
        name: input.location,
        location: input.location,
        currencyCode: input.currencyCode,
        balance: input.balance ?? "0",
        includeInAnalytics: false, // cash is excluded from analytics by default
      },
    });
    revalidateTag("accounts", "default");
    revalidatePath("/", "layout");
    return account;
  },
);

// ─────────────────────────────────────────────────────────────
// Create institution (standalone)
// ─────────────────────────────────────────────────────────────

const createInstitutionSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.nativeEnum(InstitutionKind),
});

export const createInstitutionAction = withUserAction(
  createInstitutionSchema,
  async (userId, input) => {
    const institution = await db.institution.create({
      data: { userId, name: input.name, kind: input.kind },
    });
    revalidateTag("institutions", "default");
    revalidatePath("/", "layout");
    return institution;
  },
);

// ─────────────────────────────────────────────────────────────
// FX Pair management (E5)
// ─────────────────────────────────────────────────────────────

const addFxPairSchema = z.object({
  from: z.string().min(1).max(10).toUpperCase(),
  to: z.string().min(1).max(10).toUpperCase(),
});

export async function addFxPairAction(from: string, to: string) {
  const userId = await getCurrentUserId();
  const parsed = addFxPairSchema.safeParse({ from, to });
  if (!parsed.success) {
    return actionError("validation_error" as Parameters<typeof actionError>[0]);
  }
  const { from: f, to: t } = parsed.data;
  if (f === t) {
    return actionError("validation_error" as Parameters<typeof actionError>[0]);
  }
  const pair = `${f}/${t}`;

  const settings = await db.budgetSettings.findUnique({
    where: { userId },
    select: { shownFxPairs: true },
  });

  const current = settings?.shownFxPairs ?? [];
  if (current.includes(pair)) {
    return actionOk({ pair });
  }

  // If shownFxPairs is empty (uses defaults), start from defaults before adding
  const { DEFAULT_FX_PAIRS } = await import("@/lib/data/wallet");
  const base = current.length > 0 ? current : [...DEFAULT_FX_PAIRS];
  const next = [...base, pair];

  await db.budgetSettings.upsert({
    where: { userId },
    create: { userId, shownFxPairs: next },
    update: { shownFxPairs: next },
  });

  revalidatePath("/wallet", "layout");
  return actionOk({ pair });
}

const removeFxPairSchema = z.object({
  pair: z.string().min(3).max(21),
});

export async function removeFxPairAction(pair: string) {
  const userId = await getCurrentUserId();
  const parsed = removeFxPairSchema.safeParse({ pair });
  if (!parsed.success) {
    return actionError("validation_error" as Parameters<typeof actionError>[0]);
  }

  const { DEFAULT_FX_PAIRS } = await import("@/lib/data/wallet");

  const settings = await db.budgetSettings.findUnique({
    where: { userId },
    select: { shownFxPairs: true },
  });

  // If using defaults, materialize them first then remove
  const current =
    settings?.shownFxPairs && settings.shownFxPairs.length > 0
      ? settings.shownFxPairs
      : [...DEFAULT_FX_PAIRS];

  const next = current.filter((p) => p !== parsed.data.pair);

  await db.budgetSettings.upsert({
    where: { userId },
    create: { userId, shownFxPairs: next },
    update: { shownFxPairs: next },
  });

  revalidatePath("/wallet", "layout");
  return actionOk({ pair: parsed.data.pair });
}

export async function refreshFxRatesAction() {
  const userId = await getCurrentUserId();
  if (!userId) return actionError("not_found");

  try {
    const { fetchCbrRates } = await import("@/lib/fx/cbr-fetcher");
    const { persistRates } = await import("@/lib/fx/persist");
    const cbrRates = await fetchCbrRates();
    const rubRates: Record<string, number> = {};
    for (const [code, entry] of Object.entries(cbrRates)) {
      rubRates[code] = entry.rate;
    }
    await persistRates(rubRates);
  } catch (e) {
    console.error("[refreshFxRatesAction] failed:", e);
    return actionError("internal_error");
  }

  revalidatePath("/wallet", "layout");
  return actionOk({ refreshed: true });
}
