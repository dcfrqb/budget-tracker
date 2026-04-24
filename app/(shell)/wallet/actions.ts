"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import { accountCreateSchema, accountUpdateSchema } from "@/lib/validation/account";
import { z } from "zod";
import { InstitutionKind } from "@prisma/client";
import {
  createAccount,
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  deleteAccount,
} from "@/lib/data/_mutations/accounts";
import { db } from "@/lib/db";

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
    const account = await createAccount(userId, { ...accountData, institutionId });
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
    const account = await updateAccount(userId, id, parsed.data);
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
