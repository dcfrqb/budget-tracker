import { cache } from "react";
import type { PlannedEvent } from "@prisma/client";
import { db } from "@/lib/db";

// Для события с repeatsYearly=true генерирует вхождения в указанном диапазоне лет.
function expandRepeatingEvent(
  event: PlannedEvent,
  from: Date,
  to: Date,
): PlannedEvent[] {
  const results: PlannedEvent[] = [];
  const fromYear = from.getFullYear();
  const toYear = to.getFullYear();

  for (let year = fromYear; year <= toYear; year++) {
    const date = new Date(event.eventDate);
    date.setFullYear(year);
    if (date >= from && date <= to) {
      results.push({ ...event, eventDate: date });
    }
  }
  return results;
}

export const getPlannedEvents = cache(async (
  userId: string,
  opts: { from?: Date; to?: Date } = {},
): Promise<PlannedEvent[]> => {
  const events = await db.plannedEvent.findMany({
    where: { userId },
    orderBy: { eventDate: "asc" },
  });

  if (!opts.from && !opts.to) return events;

  const from = opts.from ?? new Date(0);
  const to = opts.to ?? new Date(9999, 11, 31);

  const result: PlannedEvent[] = [];
  for (const event of events) {
    if (event.repeatsYearly) {
      result.push(...expandRepeatingEvent(event, from, to));
    } else if (event.eventDate >= from && event.eventDate <= to) {
      result.push(event);
    }
  }

  return result.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
});

export const getPlannedEventById = cache(async (userId: string, id: string) => {
  return db.plannedEvent.findFirst({
    where: { id, userId },
    include: { fund: true },
  });
});
