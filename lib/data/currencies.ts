import { cache } from "react";
import { db } from "@/lib/db";
import type { Currency } from "@prisma/client";

// All currencies in the database, ordered by code.
export const listAllCurrencies = cache(async (): Promise<Currency[]> => {
  return db.currency.findMany({ orderBy: { code: "asc" } });
});
