import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  CUSTOMER_RELEASE_PHASES,
  inspectCustomerReleaseEnvironment,
  inspectCustomerReleaseFlags,
  type CustomerReleasePhaseId,
} from "@/domain/customer-release-readiness";

export type CustomerReleaseReadinessReport = Awaited<ReturnType<typeof getCustomerReleaseReadiness>>;

export async function getCustomerReleaseReadiness() {
  const environment = inspectCustomerReleaseEnvironment(process.env);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim();
  const canProbe = Boolean(supabaseUrl && supabaseSecret);
  const database = canProbe
    ? createClient(supabaseUrl!, supabaseSecret!, {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
        global: { headers: { "X-Client-Info": "ninh-binh-journey-release-readiness" } },
      })
    : null;

  const phases = await Promise.all(CUSTOMER_RELEASE_PHASES.map(async (phase) => {
    if (!database) return { ...phase, status: "unchecked" as const, missingContracts: phase.probes.map((probe) => probe.table) };
    const results = await Promise.all(phase.probes.map(async (probe) => {
      const { error } = await database.from(probe.table).select(probe.columns, { head: true }).limit(1);
      return { table: probe.table, ready: !error };
    }));
    const missingContracts = results.filter((result) => !result.ready).map((result) => result.table);
    return { ...phase, status: missingContracts.length === 0 ? "ready" as const : "missing" as const, missingContracts };
  }));

  const phaseReady = Object.fromEntries(phases.map((phase) => [phase.id, phase.status === "ready"])) as Record<CustomerReleasePhaseId, boolean>;
  const flags = inspectCustomerReleaseFlags(process.env, phaseReady);
  const environmentReady = environment.every((check) => check.ready);
  const schemaReady = phases.every((phase) => phase.status === "ready");
  const unsafeEnabledFlags = flags.filter((flag) => flag.enabled && !flag.ready).map((flag) => flag.name);

  return {
    generatedAt: new Date().toISOString(),
    environment,
    phases,
    flags,
    environmentReady,
    schemaReady,
    safeForCanary: environmentReady && schemaReady && unsafeEnabledFlags.length === 0,
    unsafeEnabledFlags,
  };
}
