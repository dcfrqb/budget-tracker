import { getCurrentUserId } from "@/lib/api/auth";
import { getUserDataBundle } from "@/lib/data/export";
import { serverError } from "@/lib/api/response";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { dayKeyInTz } from "@/lib/format/date";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [userId, tz] = await Promise.all([getCurrentUserId(), getCurrentUserTz()]);
    const bundle = await getUserDataBundle(userId);

    const date = dayKeyInTz(new Date(), tz); // YYYY-MM-DD in user's timezone
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
