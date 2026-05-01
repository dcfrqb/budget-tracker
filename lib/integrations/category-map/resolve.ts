import { cache } from "react";
import { db } from "@/lib/db";
import { mccToInternalKey, namePatternFor } from "./mcc";

type ResolveArgs = {
  userId: string;
  mcc?: string;
  rawCategoryName?: string;
  merchantName?: string;
};

const loadUserCategories = cache(async (userId: string) => {
  return db.category.findMany({
    where: { userId },
    select: { id: true, name: true, mccCodes: true },
  });
});

export async function resolveCategoryId(args: ResolveArgs): Promise<string | null> {
  const cats = await loadUserCategories(args.userId);
  if (cats.length === 0) return null;

  // 1. user-defined MCC override on Category.mccCodes
  if (args.mcc) {
    const direct = cats.find((c) => c.mccCodes.includes(args.mcc!));
    if (direct) return direct.id;
  }

  // 2. MCC → internal key → name pattern
  const key = mccToInternalKey(args.mcc);
  if (key) {
    const pattern = namePatternFor(key);
    const byKey = cats.find((c) => pattern.test(c.name));
    if (byKey) return byKey.id;
  }

  // 3. T-bank rawCategoryName substring match against user's category names
  if (args.rawCategoryName) {
    const lower = args.rawCategoryName.toLowerCase();
    const byRaw = cats.find(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        lower.includes(c.name.toLowerCase()),
    );
    if (byRaw) return byRaw.id;
  }

  return null;
}
