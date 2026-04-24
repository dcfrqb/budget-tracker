import { db } from "@/lib/db";
import { DEFAULT_USER_EMAIL, DEFAULT_USER_ID } from "@/lib/constants";
import type { UserUpdateInput } from "@/lib/validation/profile";

/**
 * Idempotently ensures the default single user row exists.
 * Does NOT create BudgetSettings or categories — those are done only in onboarding.
 */
export async function ensureDefaultUser(): Promise<{
  id: string;
  onboardedAt: Date | null;
}> {
  const user = await db.user.upsert({
    where: { id: DEFAULT_USER_ID },
    create: { id: DEFAULT_USER_ID, email: DEFAULT_USER_EMAIL },
    update: {},
    select: { id: true, onboardedAt: true },
  });
  return user;
}

export async function updateUserProfile(
  userId: string,
  input: UserUpdateInput,
) {
  return db.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
    },
    select: { id: true, name: true, gender: true, email: true },
  });
}
