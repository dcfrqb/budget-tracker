import { z } from "zod";
import { CategoryKind } from "@prisma/client";
import { zCuid, zPercent } from "./shared";

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.nativeEnum(CategoryKind),
  icon: z.string().max(16).nullish(),
  color: z.string().max(32).nullish(),
  parentId: zCuid.nullish(),
  sortOrder: z.number().int().nonnegative().optional(),
  limitEconomy: zPercent.nullish(),
  limitNormal: zPercent.nullish(),
  limitFree: zPercent.nullish(),
});

// PATCH: допускает archivedAt: null для восстановления (unarchive).
export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .extend({
    archivedAt: z.null().optional(),
    essential: z.boolean().optional(),
  });

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
