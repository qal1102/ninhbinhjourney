import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicEnvironment } from "@/config/experience";
import type { Database } from "@/types/database.generated";

export async function updateSession(request: NextRequest) {
  const environment = readPublicEnvironment();
  if (environment.status !== "ready") {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // This validates and refreshes the auth token. Authorization is still checked
  // inside every server handler and PostgreSQL policy.
  await supabase.auth.getUser();
  return response;
}
