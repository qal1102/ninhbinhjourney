import { notFound, redirect } from "next/navigation";
import { IncidentCoordination } from "@/components/ops/incident-coordination";
import { OpsShell } from "@/components/ops/ops-shell";
import { DESTINATIONS } from "@/content/destinations";
import { DomainError } from "@/domain/errors";
import { can } from "@/domain/permissions";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

function sopSteps(value: Json) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (step): step is { order: number; instruction: string } =>
      typeof step === "object" &&
      step !== null &&
      "order" in step &&
      "instruction" in step &&
      typeof step.order === "number" &&
      typeof step.instruction === "string",
  );
}

export default async function OpsIncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  const { id } = await params;
  const supabase = await createClient();
  const { data: incident, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", id)
    .eq("demo_run_id", context.run.id)
    .maybeSingle();
  if (error) throw error;
  if (!incident) notFound();

  const [{ data: resources }, { data: audit }, { data: members }, sopResult] =
    await Promise.all([
      supabase
        .from("resource_requests")
        .select("*")
        .eq("incident_id", incident.id)
        .eq("demo_run_id", context.run.id),
      supabase
        .from("audit_events")
        .select("*")
        .eq("entity_type", "incident")
        .eq("entity_id", incident.id)
        .eq("demo_run_id", context.run.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("demo_run_members")
        .select("*")
        .eq("demo_run_id", context.run.id)
        .eq("status", "active"),
      incident.sop_id
        ? supabase.from("sops").select("*").eq("id", incident.sop_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  if (sopResult.error) throw sopResult.error;
  const site = DESTINATIONS.find(
    (destination) => destination.id === incident.site_id,
  );
  const resource = resources?.[0];
  const sop = sopResult.data;

  return (
    <OpsShell
      title={`${incident.severity} · ${incident.category}`}
      eyebrow={`Incident ${incident.id.slice(0, 8)} · ${incident.status}`}
      operator={context.operator}
      room={context.run}
    >
      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#d7d5cd] bg-white p-6">
            <dl className="grid gap-5 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#59654b]">
                  Site
                </dt>
                <dd className="mt-2 font-bold">
                  {site?.name.vi ?? "Configured site"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#59654b]">
                  Reported
                </dt>
                <dd className="mt-2 text-sm">
                  {new Date(incident.created_at).toLocaleString("vi-VN")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#59654b]">
                  Wait observed
                </dt>
                <dd className="mt-2 font-bold">
                  {incident.wait_time_minutes === null
                    ? "Not stated"
                    : `${incident.wait_time_minutes} min`}
                </dd>
              </div>
            </dl>
            <h2 className="font-display mt-7 text-2xl">Confirmed summary</h2>
            <p className="mt-3 leading-7">{incident.summary}</p>
            <details className="mt-5 rounded-xl bg-[#f4f0e7] p-4">
              <summary className="cursor-pointer text-sm font-bold">
                Original transcript
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                {incident.transcript}
              </p>
            </details>
          </section>

          {sop ? (
            <section className="rounded-2xl border border-[#e0c997] bg-[#fff8e9] p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#784b13]">
                {sop.code} · suggested operational reference
              </p>
              <h2 className="font-display mt-2 text-2xl">{sop.title}</h2>
              <p className="mt-3 leading-7">{sop.summary}</p>
              <ol className="mt-5 space-y-3">
                {sopSteps(sop.steps).map((step) => (
                  <li
                    key={step.order}
                    className="grid grid-cols-[2rem_1fr] gap-3 text-sm leading-6"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#183f34] font-bold text-white">
                      {step.order}
                    </span>
                    <span>{step.instruction}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-[#e0c997] pt-4 text-xs font-bold text-[#784b13]">
                {sop.approval_note}. Approval policy: {sop.approval_policy}.
                Source: {sop.source_document}, p. {sop.source_page ?? "n/a"}.
              </p>
            </section>
          ) : null}

          <section className="rounded-2xl border border-[#d7d5cd] bg-white p-6">
            <h2 className="font-display text-2xl">Audit trail</h2>
            <ol className="mt-5 space-y-4">
              {(audit ?? []).map((event) => (
                <li
                  key={event.id}
                  className="border-l-2 border-[#a8cec1] pl-4"
                >
                  <p className="text-sm font-bold">{event.action}</p>
                  <p className="mt-1 text-xs text-[#59654b]">
                    Actor …{event.actor_user_id?.slice(-6) ?? "system"} ·{" "}
                    {new Date(event.created_at).toLocaleString("vi-VN")}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <IncidentCoordination
            incident={incident}
            members={members ?? []}
            resourceStatus={resource?.status ?? null}
            editable={can(
              context.operator.role,
              "change-safety-operation",
            )}
          />
          <section className="rounded-2xl border border-[#d7d5cd] bg-white p-5">
            <h2 className="font-display text-2xl">Resource request</h2>
            {resource ? (
              <dl className="mt-4 grid gap-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#59654b]">Resource</dt>
                  <dd className="font-bold">{resource.resource_type}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#59654b]">Quantity</dt>
                  <dd className="font-bold">{resource.quantity}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#59654b]">State</dt>
                  <dd className="font-bold">{resource.status}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-[#59654b]">
                No resource was requested with this incident.
              </p>
            )}
          </section>
        </aside>
      </div>
    </OpsShell>
  );
}
