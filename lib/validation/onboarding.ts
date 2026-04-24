import { z } from "zod";
import { BudgetMode, Gender } from "@prisma/client";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";

const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code);

export const onboardingSchema = z.object({
  name: z.string().min(1).max(80),
  gender: z.nativeEnum(Gender).optional(),
  primaryCurrencyCode: z
    .string()
    .refine((v) => SUPPORTED_CURRENCY_CODES.includes(v as (typeof SUPPORTED_CURRENCY_CODES)[number]), {
      message: "Unsupported currency",
    }),
  activeMode: z.nativeEnum(BudgetMode),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
