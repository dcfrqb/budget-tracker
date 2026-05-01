"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { listExternalAccountsForCredential } from "@/lib/data/_mutations/integrations";

const accountIdSchema = z.string().cuid();

export async function pullRequisitesAction(
  accountId: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = accountIdSchema.safeParse(accountId);
  if (!parsed.success) {
    return { ok: false, error: "invalid_account_id" };
  }

  const userId = await getCurrentUserId();

  const link = await db.integrationAccountLink.findFirst({
    where: { accountId: parsed.data },
    select: { credentialId: true, credential: { select: { userId: true } } },
  });

  if (!link || link.credential.userId !== userId) {
    return { ok: false, error: "no_integration" };
  }

  try {
    await listExternalAccountsForCredential(userId, link.credentialId);
    revalidatePath(`/wallet/accounts/${parsed.data}/edit`);
    revalidatePath("/wallet");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
