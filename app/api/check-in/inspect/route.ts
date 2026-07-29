import { InspectPassRequestSchema } from "@/domain/schemas";
import { toSafeError } from "@/domain/errors";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    await getActiveOperatorRun([
      "check-in-agent",
      "site-supervisor",
      "icc-operator",
      "admin",
    ]);
    const input = InspectPassRequestSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("inspect_pass_access", {
      p_lookup_value: input.lookupValue,
      p_lookup_kind: input.lookupKind,
    });
    if (error) throw error;
    return Response.json(
      { result: data },
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
