import { z } from "zod";
import { Gender } from "@prisma/client";

export const userUpdateSchema = z.object({
  name: z.string().max(120).optional(),
  gender: z.nativeEnum(Gender).optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
