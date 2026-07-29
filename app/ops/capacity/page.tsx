import { redirect } from "next/navigation";
import { DomainError } from "@/domain/errors";
import { can } from "@/domain/permissions";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";
import { OpsShell } from "@/components/ops/ops-shell";
import { CapacityControl } from "@/components/ops/capacity-control";

export default async function OpsCapacityPage() {
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
    redirect("/ops/settings/demo");
  }
  const supabase = await createClient();
  const { data: slots } = await supabase
    .from("capacity_slots")
    .select("*")
    .eq("demo_run_id", context.run.id)
    .order("start_time");
  return (
    <OpsShell
      title="Capacity & availability"
      eyebrow="W2 · operations to sale"
      operator={context.operator}
      room={context.run}
    >
      <CapacityControl
        slots={slots ?? []}
        demoRunId={context.run.id}
        editable={can(context.operator.role, "change-safety-operation")}
      />
    </OpsShell>
  );
}
