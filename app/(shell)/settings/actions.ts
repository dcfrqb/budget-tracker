"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { updateUserProfile } from "@/lib/data/_mutations/users";
import { updateBudgetSettings } from "@/lib/data/_mutations/budget-settings";
import { wipeAllUserData } from "@/lib/data/_mutations/wipe";
import { userUpdateSchema } from "@/lib/validation/profile";
import { budgetSettingsUpdateSchema } from "@/lib/validation/budget-settings";

const COOKIE_KEY = "bdg:locale";
const VALID_LOCALES = new Set(["ru", "en"]);

/** Server action: sets bdg:locale cookie and revalidates the whole layout. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const value = formData.get("locale");
  if (typeof value !== "string" || !VALID_LOCALES.has(value)) return;

  const jar = await cookies();
  jar.set(COOKIE_KEY, value, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false,
  });

  revalidatePath("/", "layout");
}

/** Server action: updates user name and gender. */
export async function updateProfileAction(
  formData: FormData,
): Promise<{ error: true } | undefined> {
  try {
    const userId = await getCurrentUserId();
    const raw = {
      name: (formData.get("name") as string | null) ?? undefined,
      gender: (formData.get("gender") as string | null) ?? undefined,
    };
    const parsed = userUpdateSchema.safeParse(raw);
    if (!parsed.success) return { error: true };

    await updateUserProfile(userId, parsed.data);
    revalidatePath("/settings");
  } catch {
    return { error: true };
  }
}

/** Server action: updates activeMode and primaryCurrencyCode. */
export async function updateBudgetSettingsAction(
  formData: FormData,
): Promise<{ error: true } | undefined> {
  try {
    const userId = await getCurrentUserId();
    const raw = {
      activeMode: (formData.get("activeMode") as string | null) ?? undefined,
      primaryCurrencyCode:
        (formData.get("primaryCurrencyCode") as string | null) ?? undefined,
    };
    const parsed = budgetSettingsUpdateSchema.safeParse(raw);
    if (!parsed.success) return { error: true };

    await updateBudgetSettings(userId, parsed.data);
    revalidatePath("/settings");
  } catch {
    return { error: true };
  }
}

/** Server action: wipes all user data, then redirects to /. */
export async function wipeAllDataAction(): Promise<{ error: true } | undefined> {
  try {
    const userId = await getCurrentUserId();
    await wipeAllUserData(userId);
  } catch {
    return { error: true };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
