import { UpdateCapacityRequestSchema } from "@/domain/schemas";
import { toSafeError } from "@/domain/errors";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await getActiveOperatorRun(["site-supervisor", "icc-operator", "admin"]);
    const input = UpdateCapacityRequestSchema.parse(await request.json());
    const { id } = await context.params;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_capacity_slot", {
      p_slot_id: id,
      p_capacity: input.capacity,
      p_status: input.status,
    });
    if (error) throw error;
    return Response.json(
      { slot: data },
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
