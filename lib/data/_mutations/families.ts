import { FamilyRole } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  FamilyCreateInput,
  FamilyUpdateInput,
} from "@/lib/validation/family";
import type {
  FamilyMemberCreateInput,
  FamilyMemberUpdateInput,
} from "@/lib/validation/family-member";

// ─────────────────────────────────────────────────────────────
// Family mutations
// ─────────────────────────────────────────────────────────────

export async function createFamily(userId: string, input: FamilyCreateInput) {
  return db.$transaction(async (tx) => {
    const family = await tx.family.create({
      data: {
        name: input.name,
        note: input.note ?? null,
        ownerId: userId,
      },
    });

    // Auto-create owner member record
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await tx.familyMember.create({
      data: {
        familyId: family.id,
        userId,
        displayName: user?.name ?? "Owner",
        letter: (user?.name ?? "O").charAt(0).toUpperCase(),
        role: FamilyRole.OWNER,
      },
    });

    return family;
  });
}

export async function updateFamily(
  userId: string,
  id: string,
  input: FamilyUpdateInput,
) {
  const existing = await db.family.findFirst({ where: { id, ownerId: userId } });
  if (!existing)
    throw Object.assign(new Error("family not found"), { code: "NOT_FOUND" });

  return db.family.update({
    where: { id },
    data: {
      name: input.name,
      note: input.note ?? null,
    },
  });
}

export async function deleteFamily(userId: string, id: string) {
  const existing = await db.family.findFirst({ where: { id, ownerId: userId } });
  if (!existing)
    throw Object.assign(new Error("family not found"), { code: "NOT_FOUND" });

  await db.family.delete({ where: { id } });
  return { id };
}

// ─────────────────────────────────────────────────────────────
// FamilyMember mutations
// ─────────────────────────────────────────────────────────────

export async function addFamilyMember(
  userId: string,
  familyId: string,
  input: FamilyMemberCreateInput,
) {
  // Only family owner can add members
  const family = await db.family.findFirst({ where: { id: familyId, ownerId: userId } });
  if (!family)
    throw Object.assign(new Error("family not found or not owner"), { code: "NOT_FOUND" });

  const letter =
    input.letter?.charAt(0).toUpperCase() ??
    input.displayName.charAt(0).toUpperCase();

  return db.familyMember.create({
    data: {
      familyId,
      displayName: input.displayName,
      letter,
      color: input.color ?? null,
      role: input.role ?? FamilyRole.MEMBER,
      // No userId — guest participant (single-user MVP)
    },
  });
}

export async function updateFamilyMember(
  userId: string,
  memberId: string,
  input: FamilyMemberUpdateInput,
) {
  const member = await db.familyMember.findFirst({
    where: { id: memberId },
    include: { family: true },
  });
  if (!member)
    throw Object.assign(new Error("member not found"), { code: "NOT_FOUND" });
  if (member.family.ownerId !== userId)
    throw Object.assign(new Error("not owner"), { code: "NOT_FOUND" });

  const data: {
    displayName?: string;
    letter?: string | null;
    color?: string | null;
    role?: FamilyRole;
  } = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.letter !== undefined)
    data.letter = input.letter?.charAt(0).toUpperCase() ?? null;
  if (input.color !== undefined) data.color = input.color ?? null;
  if (input.role !== undefined) data.role = input.role;

  return db.familyMember.update({ where: { id: memberId }, data });
}

export async function removeFamilyMember(userId: string, memberId: string) {
  const member = await db.familyMember.findFirst({
    where: { id: memberId },
    include: { family: true },
  });
  if (!member)
    throw Object.assign(new Error("member not found"), { code: "NOT_FOUND" });
  if (member.family.ownerId !== userId)
    throw Object.assign(new Error("not owner"), { code: "NOT_FOUND" });
  // Owner cannot be removed
  if (member.role === FamilyRole.OWNER)
    throw Object.assign(new Error("cannot remove owner"), { code: "CONFLICT" });

  await db.familyMember.delete({ where: { id: memberId } });
  return { id: memberId };
}
