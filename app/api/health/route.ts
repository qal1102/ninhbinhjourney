import { readPublicEnvironment } from "@/config/experience";

export async function GET() {
  const environment = readPublicEnvironment();
  if (environment.status !== "ready") {
    return Response.json(
      {
        ok: false,
        dataMode: "supabase-shared",
        environment: "unavailable",
        missing: environment.missing,
        issues: environment.issues,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return Response.json(
    {
      ok: true,
      dataMode: environment.config.dataMode,
      experienceMode: environment.config.mode,
      realtimeRequired: environment.config.realtimeRequired,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
