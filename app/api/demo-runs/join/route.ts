import { cookies } from "next/headers";
import { JoinDemoRunInputSchema } from "@/domain/schemas";
import { DomainError, toSafeError } from "@/domain/errors";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const input = JoinDemoRunInputSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !user.is_anonymous) {
      throw new DomainError(
        "PERMISSION_DENIED",
        "An anonymous visitor session is required to join a demo room.",
      );
    }

    const { data, error } = await supabase.rpc("join_demo_run", {
      p_raw_token: input.token,
    });
    const joined = data?.[0];

    if (error || !joined) {
      throw error ?? new Error("Demo room join failed.");
    }

    const cookieStore = await cookies();
    cookieStore.set("nbj-active-run", joined.demo_run_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(joined.expires_at),
    });

    return Response.json(
      {
        demoRunId: joined.demo_run_id,
        tenantId: joined.tenant_id,
        sourceCode: joined.qr_source_code,
        expiresAt: joined.expires_at,
      },
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
