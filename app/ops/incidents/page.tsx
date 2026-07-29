import Link from "next/link";
import { redirect } from "next/navigation";
import { OpsShell } from "@/components/ops/ops-shell";
import { DESTINATIONS } from "@/content/destinations";
import { DomainError } from "@/domain/errors";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";

const siteNames = new Map(
  DESTINATIONS.map((destination) => [
    destination.id,
    destination.name.vi,
  ]),
);

export default async function OpsIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const severity = typeof params.severity === "string" ? params.severity : "";
  const supabase = await createClient();
  let query = supabase
    .from("incidents")
    .select("*")
    .eq("demo_run_id", context.run.id)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);
  const { data: incidents, error } = await query;
  if (error) throw error;

  return (
    <OpsShell
      title="Incidents"
      eyebrow="Confirmed records · room scoped"
      operator={context.operator}
      room={context.run}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm leading-6 text-[#59654b]">
          Only human-confirmed drafts appear here. Status, assignment and
          resource changes are permission-checked and audited.
        </p>
        <Link
          href="/ops/copilot"
          className="min-h-11 rounded-full bg-[#183f34] px-5 py-3 text-sm font-bold text-white"
        >
          New incident draft
        </Link>
      </div>
      <form className="mt-5 grid gap-3 rounded-2xl border border-[#d7d5cd] bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
        <select
          name="status"
          defaultValue={status}
          className="min-h-11 rounded-xl border border-[#c9ccc5] bg-white px-4"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="in-progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          name="severity"
          defaultValue={severity}
          className="min-h-11 rounded-xl border border-[#c9ccc5] bg-white px-4"
        >
          <option value="">All severities</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
          <option value="P4">P4</option>
        </select>
        <button className="min-h-11 rounded-full bg-[#183f34] px-5 font-bold text-white">
          Filter
        </button>
      </form>
      <div className="mt-5 grid gap-4">
        {(incidents ?? []).map((incident) => (
          <Link
            key={incident.id}
            href={`/ops/incidents/${incident.id}`}
            className="grid gap-4 rounded-2xl border border-[#d7d5cd] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[5rem_1fr_auto]"
          >
            <span
              className={`grid h-12 w-12 place-items-center rounded-full text-sm font-extrabold ${
                incident.severity === "P1" || incident.severity === "P2"
                  ? "bg-[#ffe2dc] text-[#8a2f22]"
                  : "bg-[#eef3ef] text-[#356957]"
              }`}
            >
              {incident.severity}
            </span>
            <div>
              <p className="font-bold">
                {incident.category} ·{" "}
                {siteNames.get(incident.site_id) ?? "Configured site"}
              </p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#59654b]">
                {incident.summary}
              </p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-bold">{incident.status}</p>
              <p className="mt-1 text-xs text-[#59654b]">
                {new Date(incident.created_at).toLocaleString("vi-VN")}
              </p>
            </div>
          </Link>
        ))}
        {(incidents ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#bbbfb8] bg-white/55 p-10 text-center">
            <p className="font-display text-2xl">No confirmed incidents</p>
            <p className="mt-2 text-sm text-[#59654b]">
              The current room has no incident matching this filter.
            </p>
          </div>
        ) : null}
      </div>
    </OpsShell>
  );
}
