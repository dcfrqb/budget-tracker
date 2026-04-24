"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { onboardingSchema } from "@/lib/validation/onboarding";

const ONBOARDED_COOKIE = "bdg:onboarded";

// Default categories created during onboarding.
// Using 3-letter code-labels consistent with the terminal-quant design system.
// Colors from design tokens (globals.css): pos=#3FB950 info=#79C0FF warn=#D29922 accent=#58D3A3 muted=#7D8898
const DEFAULT_CATEGORIES = [
  { name: "Еда",          icon: "ЕДА", color: "#3FB950", sortOrder: 0 },
  { name: "Транспорт",    icon: "ТРН", color: "#79C0FF", sortOrder: 1 },
  { name: "ЖКХ",          icon: "ЖКХ", color: "#D29922", sortOrder: 2 },
  { name: "Развлечения",  icon: "РЗВ", color: "#58D3A3", sortOrder: 3 },
  { name: "Здоровье",     icon: "ЗДР", color: "#3FB950", sortOrder: 4 },
  { name: "Одежда",       icon: "ОДЖ", color: "#79C0FF", sortOrder: 5 },
  { name: "Подписки",     icon: "ПДП", color: "#79C0FF", sortOrder: 6 },
  { name: "Прочее",       icon: "ПРЧ", color: "#7D8898", sortOrder: 7 },
] as const;

export async function completeOnboardingAction(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const raw = {
    name: formData.get("name"),
    gender: formData.get("gender") || undefined,
    primaryCurrencyCode: formData.get("primaryCurrencyCode"),
    activeMode: formData.get("activeMode"),
  };

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "validation" };
  }

  const userId = await getCurrentUserId();

  try {
    await db.$transaction(async (tx) => {
      // Update user name, gender, and mark as onboarded
      await tx.user.update({
        where: { id: userId },
        data: {
          name: parsed.data.name,
          ...(parsed.data.gender !== undefined ? { gender: parsed.data.gender } : {}),
          onboardedAt: new Date(),
        },
      });

      // Create BudgetSettings
      await tx.budgetSettings.upsert({
        where: { userId },
        create: {
          userId,
          activeMode: parsed.data.activeMode,
          primaryCurrencyCode: parsed.data.primaryCurrencyCode,
        },
        update: {
          activeMode: parsed.data.activeMode,
          primaryCurrencyCode: parsed.data.primaryCurrencyCode,
        },
      });

      // Create default expense categories (only if none exist yet)
      const existingCount = await tx.category.count({ where: { userId } });
      if (existingCount === 0) {
        await tx.category.createMany({
          data: DEFAULT_CATEGORIES.map((cat) => ({
            userId,
            name: cat.name,
            kind: "EXPENSE" as const,
            icon: cat.icon,
            color: cat.color,
            sortOrder: cat.sortOrder,
          })),
        });
      }
    });
  } catch {
    return { error: "save" };
  }

  // Set onboarded cookie (readable by Edge runtime middleware)
  const jar = await cookies();
  jar.set(ONBOARDED_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false,
  });

  revalidatePath("/", "layout");
  redirect("/");
}
