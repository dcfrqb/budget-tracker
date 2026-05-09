import { z } from "zod";
import { WorkKind, RateType } from "@prisma/client";
import { zCurrencyCode, zMoney, zIsoDate } from "./shared";

const baseShape = {
  name: z.string().min(1).max(200),
  kind: z.nativeEnum(WorkKind),
  currencyCode: zCurrencyCode,
  rateType: z.nativeEnum(RateType).nullish(),
  rateAmount: zMoney.nullish(),
  premiumAmount: zMoney.nullish(),
  premiumNote: z.string().max(500).nullish(),
  payDay: z.number().int().min(1).max(31).nullish(),
  taxRatePct: z.number().min(0).max(100).nullish(),
  hoursPerMonth: z.number().int().min(1).max(744).nullish(),
  startedAt: zIsoDate.nullish(),
  endedAt: zIsoDate.nullish(),
  isActive: z.boolean().optional(),
  note: z.string().max(500).nullish(),
};

function addCrossFieldRules<T extends z.ZodObject<typeof baseShape>>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const { kind, rateType, rateAmount, payDay, startedAt, endedAt } = data;

    if (kind === WorkKind.EMPLOYMENT) {
      if (rateType == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required_for_employment", path: ["rateType"] });
      }
      if (rateAmount == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required_for_employment", path: ["rateAmount"] });
      }
      if (rateType === RateType.MONTHLY && payDay == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required_for_monthly", path: ["payDay"] });
      }
    }

    if (kind === WorkKind.FREELANCE && rateAmount != null && rateType == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required_when_rate_set", path: ["rateType"] });
    }

    if (rateType === RateType.COMMISSION_PCT && rateAmount != null) {
      const val = Number(rateAmount);
      if (val < 0 || val > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "commission_out_of_range", path: ["rateAmount"] });
      }
    }

    if (startedAt && endedAt && endedAt < startedAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ended_before_started", path: ["endedAt"] });
    }
  });
}

const baseObject = z.object(baseShape);

export const workSourceCreateSchema = addCrossFieldRules(baseObject);

export const workSourceUpdateSchema = addCrossFieldRules(baseObject.partial() as unknown as typeof baseObject);

export type WorkSourceCreateInput = z.infer<typeof workSourceCreateSchema>;
export type WorkSourceUpdateInput = z.infer<typeof workSourceUpdateSchema>;
