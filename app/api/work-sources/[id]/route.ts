import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { workSourceUpdateSchema } from "@/lib/validation/work-source";
import { getWorkSourceById } from "@/lib/data/work-sources";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const source = await getWorkSourceById(userId, id);
    if (!source) return notFound("work source not found");
    return ok(source);
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
    const existing = await getWorkSourceById(userId, id);
    if (!existing) return notFound("work source not found");

    const body = await parseBody(req, workSourceUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.workSource.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// Soft delete: помечаем isActive=false
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await getWorkSourceById(userId, id);
    if (!existing) return notFound("work source not found");

    await db.workSource.update({
      where: { id },
      data: { isActive: false },
    });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
