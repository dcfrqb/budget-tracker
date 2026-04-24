// TODO: replace with session when auth is added
import { cache } from "react";
import { ensureDefaultUser } from "@/lib/data/_mutations/users";

export const getCurrentUserId = cache(async (): Promise<string> => {
  const { id } = await ensureDefaultUser();
  return id;
});
