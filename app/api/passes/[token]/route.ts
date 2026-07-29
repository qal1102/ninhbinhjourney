import { toSafeError } from "@/domain/errors";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_pass_snapshot", {
      p_raw_token: token,
    });
    if (error) throw error;
    if (!data) {
      return Response.json(
        { error: { code: "PASS_UNKNOWN", message: "Pass is invalid or unknown." } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { snapshot: data, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: toSafeError(error) },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
