import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { parseBody, parseWith } from "@/lib/api/validate";
import { workSourceCreateSchema } from "@/lib/validation/work-source";
import { z } from "zod";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = parseWith(listQuerySchema, params);
    if (!parsed.ok) return parsed.response;

    const sources = await db.workSource.findMany({
      where: {
        userId,
        ...(parsed.data.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: "asc" },
    });
    return ok(sources);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await parseBody(req, workSourceCreateSchema);
    if (!body.ok) return body.response;

    const source = await db.workSource.create({
      data: { ...body.data, userId },
    });
    return ok(source, 201);
  } catch (e) {
    return serverError(e);
  }
}
