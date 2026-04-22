import { z } from "zod";
import { InstitutionKind } from "@prisma/client";

export const institutionCreateSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.nativeEnum(InstitutionKind),
  logo: z.string().max(60).nullish(),
  sub: z.string().max(200).nullish(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const institutionUpdateSchema = institutionCreateSchema.partial();

export type InstitutionCreateInput = z.infer<typeof institutionCreateSchema>;
export type InstitutionUpdateInput = z.infer<typeof institutionUpdateSchema>;
