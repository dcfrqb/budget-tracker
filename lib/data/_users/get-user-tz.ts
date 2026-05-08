import "server-only";

import { cache } from "react";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID, DEFAULT_TZ } from "@/lib/constants";

export const getCurrentUserTz = cache(async (): Promise<string> => {
  const u = await db.user.findUnique({
    where: { id: DEFAULT_USER_ID },
    select: { timezone: true },
  });
  return u?.timezone ?? DEFAULT_TZ;
});
