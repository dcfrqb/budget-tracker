import { z } from "zod";
import { zCuid, zCurrencyCode, zIsoDate, zMoney } from "./shared";

export const fundContributionSchema = z.object({
  amount: zMoney,
  currencyCode: zCurrencyCode,
  accountId: zCuid,
  occurredAt: zIsoDate.optional(),
});

export type FundContributionInput = z.infer<typeof fundContributionSchema>;
