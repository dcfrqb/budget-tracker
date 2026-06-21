import { db } from "@/lib/db";

export async function dismissSignal(
  userId: string,
  signalKey: string,
  days = 7,
): Promise<void> {
  const now = new Date();
  const dismissUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  await db.dismissedSignal.upsert({
    where: { userId_signalKey: { userId, signalKey } },
    create: { userId, signalKey, dismissedAt: now, dismissUntil },
    update: { dismissedAt: now, dismissUntil },
  });
}
