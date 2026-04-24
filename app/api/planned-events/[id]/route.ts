import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { plannedEventUpdateSchema } from "@/lib/validation/planned-event";
import { getPlannedEventById } from "@/lib/data/planned-events";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const event = await getPlannedEventById(userId, id);
    if (!event) return notFound("planned event not found");
    return ok(event);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await getPlannedEventById(userId, id);
    if (!existing) return notFound("planned event not found");

    const body = await parseBody(req, plannedEventUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.plannedEvent.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await getPlannedEventById(userId, id);
    if (!existing) return notFound("planned event not found");

    await db.plannedEvent.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
