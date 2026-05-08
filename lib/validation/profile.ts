import { z } from "zod";
import { Gender } from "@prisma/client";

export const userUpdateSchema = z.object({
  name: z.string().max(120).optional(),
  gender: z.nativeEnum(Gender).optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

function isValidIanaTz(v: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

export const timezoneUpdateSchema = z.object({
  timezone: z.string().refine(isValidIanaTz, { message: "Invalid timezone" }),
});

export type TimezoneUpdateInput = z.infer<typeof timezoneUpdateSchema>;
