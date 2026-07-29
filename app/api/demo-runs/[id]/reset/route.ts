import { getAuthenticatedOperator } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";
import { ResetDemoRunInputSchema } from "@/domain/schemas";
import { toSafeError } from "@/domain/errors";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await getAuthenticatedOperator(["admin"]);
    const { id } = await context.params;
    const { demoRunId } = ResetDemoRunInputSchema.parse({ demoRunId: id });
    const supabase = await createClient();
    const { error } = await supabase.rpc("reset_demo_run", {
      p_demo_run_id: demoRunId,
    });
    if (error) throw error;

    return Response.json(
      { ok: true, demoRunId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safeError = toSafeError(error);
    return Response.json(
      { error: safeError },
      {
        status:
          safeError.code === "MISSING_ENVIRONMENT"
            ? 503
            : safeError.code === "PERMISSION_DENIED"
              ? 403
              : 400,
      },
    );
  }
}
