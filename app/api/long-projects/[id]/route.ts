import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { longProjectUpdateSchema } from "@/lib/validation/long-project";
import { getLongProjectById, computeProjectProgress } from "@/lib/data/long-projects";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const project = await getLongProjectById(userId, id);
    if (!project) return notFound("project not found");

    // Загружаем транзакции для прогресса
    const transactions = await db.transaction.findMany({
      where: { longProjectId: id, deletedAt: null },
      select: { amount: true, status: true },
    });
    const progress = computeProjectProgress(project, transactions);

    return ok({ ...project, progress });
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
    const existing = await getLongProjectById(userId, id);
    if (!existing) return notFound("project not found");

    const body = await parseBody(req, longProjectUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.longProject.update({
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
    const existing = await getLongProjectById(userId, id);
    if (!existing) return notFound("project not found");

    await db.longProject.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
