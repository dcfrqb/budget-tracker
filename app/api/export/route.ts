import { getCurrentUserId } from "@/lib/api/auth";
import { getUserDataBundle } from "@/lib/data/export";
import { serverError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const bundle = await getUserDataBundle(userId);

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `budget-export-${date}.json`;

    return new Response(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
