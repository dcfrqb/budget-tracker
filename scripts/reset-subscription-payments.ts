/**
 * One-shot reset: shift nextPaymentDate for all non-deleted subscriptions of
 * DEFAULT_USER_ID to today + billingIntervalMonths.
 *
 * Idempotent per run — always forces today + interval regardless of current value.
 * Does NOT create any Transaction rows.
 *
 * Usage:
 *   cd code && npx tsx scripts/reset-subscription-payments.ts
 *
 * On prod container:
 *   docker exec budget-tracker-app npx tsx /app/scripts/reset-subscription-payments.ts
 */

import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const subs = await db.subscription.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      billingIntervalMonths: true,
      nextPaymentDate: true,
    },
  });

  if (subs.length === 0) {
    console.log("No active subscriptions found.");
    return;
  }

  console.log(`Found ${subs.length} subscription(s). Resetting nextPaymentDate...\n`);
  console.log(
    ["Name".padEnd(40), "Old date".padEnd(14), "New date"].join("  "),
  );
  console.log("-".repeat(70));

  for (const sub of subs) {
    const newDate = addMonths(today, sub.billingIntervalMonths);
    const oldStr = toIsoDate(sub.nextPaymentDate);
    const newStr = toIsoDate(newDate);

    await db.subscription.update({
      where: { id: sub.id },
      data: { nextPaymentDate: newDate },
    });

    console.log(
      [sub.name.slice(0, 40).padEnd(40), oldStr.padEnd(14), newStr].join("  "),
    );
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect().then(() => process.exit(0)));
