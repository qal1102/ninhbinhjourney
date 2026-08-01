import { NextResponse, type NextRequest } from "next/server";
import { isLegacyOpsEnabled, isLegacyOpsPath } from "@/config/legacy-ops";
import { updateSession } from "@/lib/supabase/update-session";

export async function proxy(request: NextRequest) {
  // T2: the abandoned `/ops` stack answers 404 in production rather than
  // offering a second login for a system nobody can sign into. Gated here
  // rather than route by route, so a page added under those prefixes later
  // cannot forget to opt in.
  if (!isLegacyOpsEnabled() && isLegacyOpsPath(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
