import { UpdateIncidentRequestSchema } from "@/domain/schemas";
import { toSafeError } from "@/domain/errors";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await getActiveOperatorRun(["site-supervisor", "icc-operator", "admin"]);
    const input = UpdateIncidentRequestSchema.parse(await request.json());
    const { id } = await context.params;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "update_incident_coordination",
      {
        p_incident_id: id,
        p_status: input.status,
        p_assigned_to: input.assignedTo ?? null,
        p_resource_status: input.resourceStatus ?? null,
      },
    );
    if (error) throw error;
    return Response.json(
      { incident: data },
      { headers: { "Cache-Control": "no-store" } },
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
