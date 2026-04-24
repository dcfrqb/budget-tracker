import { cache } from "react";
import { db } from "@/lib/db";

// Первая семья, где userId является owner'ом или участником.
export const getUserFamily = cache(async (userId: string) => {
  // Ищем семью, где пользователь owner
  const owned = await db.family.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (owned) return owned;

  // Или где является членом
  const membership = await db.familyMember.findFirst({
    where: { userId },
    include: { family: true },
    orderBy: { joinedAt: "asc" },
  });
  return membership?.family ?? null;
});

export const getFamilyWithMembers = cache(async (familyId: string) => {
  return db.family.findUnique({
    where: { id: familyId },
    include: {
      members: {
        orderBy: { joinedAt: "asc" },
      },
      owner: { select: { id: true, name: true, email: true } },
    },
  });
});
