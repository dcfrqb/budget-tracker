import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { institutionCreateSchema } from "@/lib/validation/institution";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await db.institution.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { sortOrder: "asc" },
      include: {
        accounts: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req, institutionCreateSchema);
  if (!body.ok) return body.response;

  try {
    const created = await db.institution.create({
      data: { ...body.data, userId: DEFAULT_USER_ID },
    });
    return ok(created, 201);
  } catch (e) {
    return serverError(e);
  }
}
