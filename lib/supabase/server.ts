import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicEnvironment } from "@/config/experience";
import { MissingEnvironmentError } from "@/domain/errors";
import type { Database } from "@/types/database.generated";

export async function createClient() {
  const environment = readPublicEnvironment();
  if (environment.status !== "ready") {
    throw new MissingEnvironmentError(environment.missing, environment.issues);
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // A Server Component cannot write response cookies. The root proxy
            // refreshes sessions and writes the corresponding response cookies.
          }
        },
      },
    },
  );
}
