import { ConfirmIncidentRequestSchema } from "@/domain/schemas";
import { toSafeError } from "@/domain/errors";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

export async function POST(request: Request) {
  try {
    const context = await getActiveOperatorRun([
      "check-in-agent",
      "site-supervisor",
      "icc-operator",
      "admin",
    ]);
    const draft = ConfirmIncidentRequestSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("confirm_incident_draft", {
      p_demo_run_id: context.run.id,
      p_draft: JSON.parse(JSON.stringify(draft)) as Json,
    });
    if (error) throw error;
    return Response.json(
      { incident: data },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safe = toSafeError(error);
    return Response.json(
      { error: safe },
      {
        status: safe.code === "PERMISSION_DENIED" ? 403 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
