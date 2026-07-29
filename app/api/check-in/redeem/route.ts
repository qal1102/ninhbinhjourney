import { RedeemPassRequestSchema } from "@/domain/schemas";
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
    const input = RedeemPassRequestSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("redeem_pass_entitlement", {
      p_lookup_value: input.lookupValue,
      p_lookup_kind: input.lookupKind,
      p_site_id: input.siteId ?? null,
      p_entitlement_id: input.entitlementId ?? null,
      p_quantity: input.quantity,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) throw error;
    return Response.json(
      { result: data?.[0] },
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
