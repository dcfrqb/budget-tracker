import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { accountReorderSchema } from "@/lib/validation/account";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await parseBody(req, accountReorderSchema);
  if (!body.ok) return body.response;

  const ids = body.data.map((x) => x.id);

  try {
    // Проверяем что все id принадлежат пользователю и не удалены.
    const existing = await db.account.findMany({
      where: { id: { in: ids }, userId: DEFAULT_USER_ID, deletedAt: null },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      return conflict("some accounts not found or not owned by user");
    }

    const updated = await db.$transaction(
      body.data.map(({ id, sortOrder }) =>
        db.account.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
