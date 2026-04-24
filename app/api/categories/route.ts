import { CategoryKind } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { parseBody, parseWith } from "@/lib/api/validate";
import { categoryCreateSchema } from "@/lib/validation/category";
import { getCategories } from "@/lib/data/categories";
import { z } from "zod";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  kind: z.nativeEnum(CategoryKind).optional(),
  includeArchived: z
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

    const categories = await getCategories(userId, {
      includeArchived: parsed.data.includeArchived,
      kind: parsed.data.kind,
    });
    return ok(categories);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await parseBody(req, categoryCreateSchema);
    if (!body.ok) return body.response;

    const category = await db.category.create({
      data: { ...body.data, userId },
    });
    return ok(category, 201);
  } catch (e) {
    return serverError(e);
  }
}
