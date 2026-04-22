import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { accountCreateSchema } from "@/lib/validation/account";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    const items = await db.account.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        deletedAt: null,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req, accountCreateSchema);
  if (!body.ok) return body.response;

  try {
    const created = await db.account.create({
      data: { ...body.data, userId: DEFAULT_USER_ID },
    });
    return ok(created, 201);
  } catch (e) {
    return serverError(e);
  }
}
