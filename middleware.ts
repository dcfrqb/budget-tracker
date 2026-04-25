import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ONBOARDED_COOKIE_NAME } from "@/lib/constants";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isOnboarded = req.cookies.get(ONBOARDED_COOKIE_NAME)?.value === "1";

  // If not onboarded and not already on /onboarding, redirect there
  if (!isOnboarded && pathname !== "/onboarding") {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // If already onboarded and visiting /onboarding, send to root
  if (isOnboarded && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - /api/* (API routes)
     *  - /_next/static (static files)
     *  - /_next/image (image optimization)
     *  - /favicon.ico, /robots.txt, and other static assets at root
     */
    "/((?!api/|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf)).*)",
  ],
};
