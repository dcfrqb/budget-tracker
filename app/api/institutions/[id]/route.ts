import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, notFound, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { institutionUpdateSchema } from "@/lib/validation/institution";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const inst = await db.institution.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      include: {
        accounts: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!inst) return notFound("institution not found");
    return ok(inst);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, institutionUpdateSchema);
  if (!body.ok) return body.response;

  try {
    const existing = await db.institution.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      select: { id: true },
    });
    if (!existing) return notFound("institution not found");

    const updated = await db.institution.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const inst = await db.institution.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      select: { id: true, _count: { select: { accounts: true } } },
    });
    if (!inst) return notFound("institution not found");
    if (inst._count.accounts > 0) {
      return conflict("institution has accounts — move or delete them first");
    }

    await db.institution.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverError(e);
  }
}
