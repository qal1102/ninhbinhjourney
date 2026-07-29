import { redirect } from "next/navigation";
import { DomainError } from "@/domain/errors";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";
import { OpsShell } from "@/components/ops/ops-shell";
import { CheckInConsole } from "@/components/ops/check-in-console";
import { readPublicEnvironment } from "@/config/experience";

export default async function OpsCheckInPage() {
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
  const { data: latest } = await supabase
    .from("bookings")
    .select("code")
    .eq("demo_run_id", context.run.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const environment = readPublicEnvironment();
  return (
    <OpsShell
      title="QR check-in"
      eyebrow="One-time redemption · manual fallback"
      operator={context.operator}
      room={context.run}
    >
      <CheckInConsole
        latestBookingCode={latest?.[0]?.code}
        showDemoScan={
          environment.status === "ready" &&
          environment.config.voiceDemoFallbackEnabled
        }
      />
    </OpsShell>
  );
}
