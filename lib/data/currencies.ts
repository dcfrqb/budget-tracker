import { db } from "@/lib/db";
import type { Currency } from "@prisma/client";

// All currencies in the database, ordered by code.
export async function listAllCurrencies(): Promise<Currency[]> {
  return db.currency.findMany({ orderBy: { code: "asc" } });
}
