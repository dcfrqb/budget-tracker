import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { parseBody, parseWith } from "@/lib/api/validate";
import { plannedEventCreateSchema } from "@/lib/validation/planned-event";
import { getPlannedEvents } from "@/lib/data/planned-events";
import { z } from "zod";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  from: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
  to: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
});

export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = parseWith(listQuerySchema, params);
    if (!parsed.ok) return parsed.response;

    const events = await getPlannedEvents(userId, parsed.data);
    return ok(events);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await parseBody(req, plannedEventCreateSchema);
    if (!body.ok) return body.response;

    const event = await db.plannedEvent.create({
      data: { ...body.data, userId },
    });
    return ok(event, 201);
  } catch (e) {
    return serverError(e);
  }
}
