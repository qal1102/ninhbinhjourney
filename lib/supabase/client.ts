"use client";

import { createBrowserClient } from "@supabase/ssr";
import { readPublicEnvironment } from "@/config/experience";
import { MissingEnvironmentError } from "@/domain/errors";
import type { Database } from "@/types/database.generated";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const environment = readPublicEnvironment();
  if (environment.status !== "ready") {
    throw new MissingEnvironmentError(environment.missing, environment.issues);
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      environment.supabaseUrl,
      environment.supabasePublishableKey,
    );
  }

  return browserClient;
}
