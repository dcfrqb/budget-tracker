import { z } from "zod";

// Денежные суммы на API-границе: строка или число, превращается в Decimal-строку.
// Храним строкой, чтобы не терять точность.
export const zMoney = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toFixed(2) : v))
  .refine((v) => /^-?\d+(\.\d{1,8})?$/.test(v), { message: "invalid money value" });

export const zCurrencyCode = z.string().min(2).max(8);

// Percent override for budget-mode limits: stored in Decimal columns,
// represents "% of trailing 6-month average" (0..1000, 4 decimal places max).
export const zPercent = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v))
  .refine(
    (v) => {
      if (!/^\d+(\.\d{1,4})?$/.test(v)) return false;
      const n = parseFloat(v);
      return n >= 0 && n <= 1000;
    },
    { message: "invalid percent value (0..1000)" },
  );

export const zIsoDate = z.union([z.string(), z.date()]).transform((v) => new Date(v));

export const zCuid = z.string().min(1);
