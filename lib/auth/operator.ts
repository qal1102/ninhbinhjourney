import { CORE_IDS, readPublicEnvironment } from "@/config/experience";
import { DomainError, MissingEnvironmentError } from "@/domain/errors";
import type { InternalRole } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export type AuthenticatedOperator = {
  userId: string;
  email: string | null;
  role: InternalRole;
  tenantId: string;
};

export async function getAuthenticatedOperator(
  allowedRoles?: InternalRole[],
): Promise<AuthenticatedOperator> {
  const environment = readPublicEnvironment();
  if (environment.status !== "ready") {
    throw new MissingEnvironmentError(environment.missing, environment.issues);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || user.is_anonymous) {
    throw new DomainError(
      "PERMISSION_DENIED",
      "A named internal operator sign-in is required.",
    );
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, status")
    .eq("tenant_id", CORE_IDS.tenantId)
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError || !memberships || memberships.length === 0) {
    throw new DomainError(
      "PERMISSION_DENIED",
      "This account has no active DestinationOS tenant membership.",
    );
  }

  const membership = memberships.find((candidate) => {
    if (!allowedRoles) return true;
    return allowedRoles.includes(candidate.role as InternalRole);
  });

  if (!membership) {
    throw new DomainError(
      "PERMISSION_DENIED",
      "Your authenticated membership does not allow this action.",
    );
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: membership.role as InternalRole,
    tenantId: membership.tenant_id,
  };
}

export async function getActiveOperatorRun(allowedRoles?: InternalRole[]) {
  const operator = await getAuthenticatedOperator(allowedRoles);
  const supabase = await createClient();
  const cookieRunId = (await cookies()).get("nbj-active-run")?.value;

  let membershipsQuery = supabase
    .from("demo_run_members")
    .select("demo_run_id, role, status, joined_at")
    .eq("user_id", operator.userId)
    .eq("status", "active");
  if (cookieRunId) {
    membershipsQuery = membershipsQuery.eq("demo_run_id", cookieRunId);
  }
  const { data: memberships, error } = await membershipsQuery
    .order("joined_at", { ascending: false })
    .limit(1);
  const membership = memberships?.[0];
  if (error || !membership) {
    throw new DomainError(
      "DEMO_ROOM_NOT_JOINED",
      "Start or select an active demo room before opening operational data.",
    );
  }
  if (
    allowedRoles &&
    !allowedRoles.includes(membership.role as InternalRole)
  ) {
    throw new DomainError(
      "PERMISSION_DENIED",
      "Your active room role does not allow this operation.",
    );
  }
  const { data: run, error: runError } = await supabase
    .from("demo_runs")
    .select("*")
    .eq("id", membership.demo_run_id)
    .eq("status", "active")
    .single();
  if (runError || !run || Date.parse(run.expires_at) <= Date.now()) {
    throw new DomainError("DEMO_ROOM_EXPIRED", "The active demo room expired.");
  }

  return {
    operator,
    run: {
      id: run.id,
      label: run.label,
      tenantId: run.tenant_id,
      regionId: run.region_id,
      operatorId: run.operator_id,
      expiresAt: run.expires_at,
    },
  };
}
