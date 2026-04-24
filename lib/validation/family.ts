import { z } from "zod";

export const familyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  note: z.string().max(500).nullish(),
});

export const familyUpdateSchema = familyCreateSchema.partial();

export type FamilyCreateInput = z.infer<typeof familyCreateSchema>;
export type FamilyUpdateInput = z.infer<typeof familyUpdateSchema>;
