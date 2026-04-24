import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { longProjectCreateSchema } from "@/lib/validation/long-project";
import { getLongProjects } from "@/lib/data/long-projects";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const projects = await getLongProjects(userId);
    return ok(projects);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await parseBody(req, longProjectCreateSchema);
    if (!body.ok) return body.response;

    const project = await db.longProject.create({
      data: { ...body.data, userId },
    });
    return ok(project, 201);
  } catch (e) {
    return serverError(e);
  }
}
