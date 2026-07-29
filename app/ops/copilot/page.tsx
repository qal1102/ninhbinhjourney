import { redirect } from "next/navigation";
import { IncidentCopilot } from "@/components/ops/incident-copilot";
import { OpsShell } from "@/components/ops/ops-shell";
import { DomainError } from "@/domain/errors";
import { can } from "@/domain/permissions";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";
import { readPublicEnvironment } from "@/config/experience";

export default async function OpsCopilotPage() {
  let context;
  try {
    context = await getActiveOperatorRun([
      "check-in-agent",
      "site-supervisor",
      "icc-operator",
      "admin",
    ]);
  } catch (error) {
    if (error instanceof DomainError && error.code === "PERMISSION_DENIED") {
      redirect("/ops/login");
    }
    if (
      error instanceof DomainError &&
      (error.code === "DEMO_ROOM_NOT_JOINED" ||
        error.code === "DEMO_ROOM_EXPIRED")
    ) {
      redirect("/ops/settings/demo");
    }
    throw error;
  }
  const supabase = await createClient();
  const { data: sops, error } = await supabase
    .from("sops")
    .select("*")
    .eq("tenant_id", context.run.tenantId)
    .order("code");
  if (error) throw error;
  const environment = readPublicEnvironment();

  return (
    <OpsShell
      title="Incident copilot"
      eyebrow="W3 · voice/text · draft before write"
      operator={context.operator}
      room={context.run}
    >
      <IncidentCopilot
        demoRunId={context.run.id}
        sops={sops ?? []}
        canConfirmCritical={can(
          context.operator.role,
          "confirm-p1-p2-incident",
        )}
        showDemoCommand={
          environment.status === "ready" &&
          environment.config.voiceDemoFallbackEnabled
        }
      />
    </OpsShell>
  );
}
