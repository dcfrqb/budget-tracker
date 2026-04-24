import { z } from "zod";
import { FamilyRole } from "@prisma/client";

export const familyMemberCreateSchema = z.object({
  displayName: z.string().min(1).max(120),
  letter: z.string().max(4).nullish(),
  color: z.string().max(32).nullish(),
  role: z.nativeEnum(FamilyRole).optional(),
});

export const familyMemberUpdateSchema = familyMemberCreateSchema.partial();

export type FamilyMemberCreateInput = z.infer<typeof familyMemberCreateSchema>;
export type FamilyMemberUpdateInput = z.infer<typeof familyMemberUpdateSchema>;
