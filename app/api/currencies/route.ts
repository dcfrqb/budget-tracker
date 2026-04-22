import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await db.currency.findMany({ orderBy: { code: "asc" } });
    return ok(items);
  } catch (e) {
    return serverError(e);
  }
}
