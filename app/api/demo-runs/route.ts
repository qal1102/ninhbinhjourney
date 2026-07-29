import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getAuthenticatedOperator } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";
import { CreateDemoRunInputSchema } from "@/domain/schemas";
import { toSafeError } from "@/domain/errors";

export async function POST(request: Request) {
  try {
    await getAuthenticatedOperator(["admin"]);
    const input = CreateDemoRunInputSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: run, error: runError } = await supabase.rpc("create_demo_run", {
      p_label: input.label,
      p_expires_in_minutes: input.expiresInMinutes,
    });

    if (runError || !run) {
      throw runError ?? new Error("Demo room was not returned.");
    }

    const rawJoinToken = randomBytes(32).toString("base64url");
    const { data: issuedTokens, error: tokenError } = await supabase.rpc(
      "issue_demo_join_token",
      {
        p_demo_run_id: run.id,
        p_raw_token: rawJoinToken,
        p_qr_source_code: input.sourceCode,
        p_expires_in_minutes: 30,
      },
    );

    if (tokenError || !issuedTokens?.[0]) {
      throw tokenError ?? new Error("Join token was not returned.");
    }

    const origin = new URL(request.url).origin;
    const visitorUrl = new URL("/demo/join", origin);
    visitorUrl.searchParams.set("token", rawJoinToken);

    const cookieStore = await cookies();
    cookieStore.set("nbj-active-run", run.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(run.expires_at),
    });

    return Response.json(
      {
        run: {
          id: run.id,
          tenantId: run.tenant_id,
          regionId: run.region_id,
          operatorId: run.operator_id,
          ownerUserId: run.owner_user_id,
          label: run.label,
          status: run.status,
          expiresAt: run.expires_at,
          createdAt: run.created_at,
        },
        visitorUrl: visitorUrl.toString(),
        joinExpiresAt: issuedTokens[0].expires_at,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safeError = toSafeError(error);
    const status =
      safeError.code === "PERMISSION_DENIED"
        ? 403
        : safeError.code === "MISSING_ENVIRONMENT"
          ? 503
          : 400;
    return Response.json({ error: safeError }, { status });
  }
}
