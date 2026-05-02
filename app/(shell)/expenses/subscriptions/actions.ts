"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { withUserAction } from "@/lib/actions/with-user";
import { actionError, actionOk } from "@/lib/actions/result";
import { getCurrentUserId } from "@/lib/api/auth";
import {
  subscriptionCreateSchema,
  subscriptionUpdateSchema,
  subscriptionPaySchema,
  subscriptionsBulkReplaceSchema,
  type SubscriptionJsonItem,
} from "@/lib/validation/subscription";
import {
  subscriptionShareCreateSchema,
  subscriptionShareUpdateSchema,
} from "@/lib/validation/subscription-share";
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  paySubscription,
} from "@/lib/data/_mutations/subscriptions";
import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export const createSubscriptionAction = withUserAction(
  subscriptionCreateSchema,
  async (userId, input) => {
    const sub = await createSubscription(userId, input);
    revalidateTag("subscriptions", "default");
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return sub;
  },
);

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateSubscriptionAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = subscriptionUpdateSchema.safeParse(rawData);
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
    const sub = await updateSubscription(userId, id, parsed.data);
    revalidateTag("subscriptions", "default");
    revalidatePath("/", "layout");
    return actionOk(sub);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

export async function deleteSubscriptionAction(id: string) {
  const userId = await getCurrentUserId();
  try {
    const result = await deleteSubscription(userId, id);
    revalidateTag("subscriptions", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Pay
// ─────────────────────────────────────────────────────────────

export async function paySubscriptionAction(id: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = subscriptionPaySchema.safeParse(rawData);
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
    const result = await paySubscription(userId, id, parsed.data);
    revalidateTag("subscriptions", "default");
    revalidateTag("transactions", "default");
    revalidatePath("/", "layout");
    return actionOk(result);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "NOT_FOUND") return actionError("not_found");
    if (err.code === "INVALID") return actionError("conflict");
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Shares CRUD
// ─────────────────────────────────────────────────────────────

export async function createShareAction(subscriptionId: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = subscriptionShareCreateSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { ok: false as const, fieldErrors };
  }
  // Verify subscription belongs to user
  const sub = await db.subscription.findFirst({
    where: { id: subscriptionId, userId, deletedAt: null },
  });
  if (!sub) return actionError("not_found");

  try {
    const share = await db.subscriptionShare.create({
      data: { subscriptionId, ...parsed.data },
    });
    revalidateTag("subscriptions", "default");
    revalidatePath("/", "layout");
    return actionOk(share);
  } catch {
    return actionError("internal_error");
  }
}

export async function updateShareAction(shareId: string, rawData: unknown) {
  const userId = await getCurrentUserId();
  const parsed = subscriptionShareUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { ok: false as const, fieldErrors };
  }
  // Verify share belongs to user's subscription
  const share = await db.subscriptionShare.findFirst({
    where: { id: shareId },
    include: { subscription: true },
  });
  if (!share || share.subscription.userId !== userId) return actionError("not_found");

  try {
    const updated = await db.subscriptionShare.update({
      where: { id: shareId },
      data: parsed.data,
    });
    revalidateTag("subscriptions", "default");
    revalidatePath("/", "layout");
    return actionOk(updated);
  } catch {
    return actionError("internal_error");
  }
}

export async function deleteShareAction(shareId: string) {
  const userId = await getCurrentUserId();
  const share = await db.subscriptionShare.findFirst({
    where: { id: shareId },
    include: { subscription: true },
  });
  if (!share || share.subscription.userId !== userId) return actionError("not_found");

  try {
    await db.subscriptionShare.delete({ where: { id: shareId } });
    revalidateTag("subscriptions", "default");
    revalidatePath("/", "layout");
    return actionOk({ id: shareId });
  } catch {
    return actionError("internal_error");
  }
}

// ─────────────────────────────────────────────────────────────
// Replace all subscriptions (JSON editor diff-apply)
// ─────────────────────────────────────────────────────────────

export type ReplaceSubscriptionsSummary = {
  created: number;
  updated: number;
  deleted: number;
};

export async function replaceSubscriptionsAction(rawItems: unknown): Promise<
  { ok: true; summary: ReplaceSubscriptionsSummary } | { ok: false; error: string }
> {
  const userId = await getCurrentUserId();

  const parsed = subscriptionsBulkReplaceSchema.safeParse(rawItems);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first.path.join(".");
    return { ok: false, error: path ? `${path}: ${first.message}` : first.message };
  }

  const items: SubscriptionJsonItem[] = parsed.data;

  const existing = await db.subscription.findMany({
    where: { userId, deletedAt: null },
    select: { id: true },
  });

  const existingIds = new Set(existing.map((s) => s.id));
  const incomingIds = new Set(items.filter((i) => i.id && existingIds.has(i.id)).map((i) => i.id!));

  const toCreate = items.filter((i) => !i.id || !existingIds.has(i.id));
  const toUpdate = items.filter((i) => i.id && existingIds.has(i.id));
  const toDeleteIds = [...existingIds].filter((id) => !incomingIds.has(id));

  try {
    await db.$transaction([
      ...toDeleteIds.map((id) =>
        db.subscription.update({ where: { id }, data: { deletedAt: new Date() } }),
      ),
      ...toUpdate.map(({ id, ...fields }) =>
        db.subscription.update({ where: { id: id! }, data: fields }),
      ),
      ...toCreate.map(({ id: _id, ...fields }) =>
        db.subscription.create({ data: { ...fields, userId } }),
      ),
    ]);

    revalidateTag("subscriptions", "default");
    revalidatePath("/expenses/subscriptions");
    revalidatePath("/", "layout");

    return {
      ok: true,
      summary: {
        created: toCreate.length,
        updated: toUpdate.length,
        deleted: toDeleteIds.length,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal_error";
    return { ok: false, error: msg };
  }
}
