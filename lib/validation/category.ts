import { z } from "zod";
import { CategoryKind } from "@prisma/client";
import { zCuid, zMoney } from "./shared";

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.nativeEnum(CategoryKind),
  icon: z.string().max(16).nullish(),
  color: z.string().max(32).nullish(),
  parentId: zCuid.nullish(),
  sortOrder: z.number().int().nonnegative().optional(),
  limitEconomy: zMoney.nullish(),
  limitNormal: zMoney.nullish(),
  limitFree: zMoney.nullish(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
