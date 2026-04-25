import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserId } from "@/lib/api/auth";
import { getUserContext } from "@/lib/data/settings";
import {
  ONBOARDED_COOKIE_NAME,
  ONBOARDED_COOKIE_OPTS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding/heal
 *
 * Sets the `bdg:onboarded` cookie when the DB confirms the user is already
 * onboarded but the cookie is absent (cleared, expired, or new device).
 *
 * Called by /onboarding/page.tsx when it detects onboardedAt != null in the
 * DB but cannot set the cookie itself (RSC write is blocked by Next.js).
 * After setting the cookie the handler redirects to "/" so the middleware
 * lets the request through on the next navigation.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const ctx = await getUserContext(userId);

    // Only set cookie when the DB confirms the user is onboarded.
    // Prevents an unauthenticated call from bypassing the onboarding flow.
    if (ctx.onboardedAt === null) {
      return NextResponse.redirect(new URL("/onboarding", req.url), 302);
    }

    const jar = await cookies();
    jar.set(ONBOARDED_COOKIE_NAME, "1", ONBOARDED_COOKIE_OPTS);

    return NextResponse.redirect(new URL("/", req.url), 302);
  } catch {
    // On unexpected error fall back to root; middleware will re-evaluate.
    return NextResponse.redirect(new URL("/", req.url), 302);
  }
}
