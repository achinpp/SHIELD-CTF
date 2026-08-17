import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Optimistic route gate.
 *
 * This only checks whether a session cookie is *present*, never whether it is
 * valid — proxy runs on every request including prefetches, so a database
 * lookup here would be a query per navigation. Holding a forged cookie gets
 * you no further than a redirect: the real check is `requireUser()` in the
 * data access layer, which every protected page calls.
 *
 * Its job is saving an unauthenticated visitor a pointless round trip, not
 * enforcing access.
 */

const PROTECTED = ["/briefing"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasCookie && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = new URL("/", request.url);
    url.searchParams.set("access", "required");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Static assets and image optimisation never need the check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"],
};
