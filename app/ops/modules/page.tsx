import { redirect } from "next/navigation";
import { OpsShell } from "@/components/ops/ops-shell";
import { DomainError } from "@/domain/errors";
import { getActiveOperatorRun } from "@/lib/auth/operator";

const futureModules = [
  {
    name: "Mobility orchestration",
    scope: "Partner dispatch, route telemetry and transport settlement.",
    dependency: "Transport partner agreements and live fleet integrations.",
  },
  {
    name: "Ritual governance",
    scope: "Authority-reviewed calendars, permissions and cultural protocols.",
    dependency: "Named ritual authority and approved organizational policy.",
  },
  {
    name: "Donation & sponsorship",
    scope: "Separate ledgers, restricted reporting and reconciliation.",
    dependency: "Legal, finance and beneficiary governance approval.",
  },
  {
    name: "Regional intelligence",
    scope: "Longitudinal demand, environmental and economic indicators.",
    dependency: "Approved datasets, retention policy and analytical mandate.",
  },
] as const;

export default async function OpsModulesPage() {
  let context;
  try {
    context = await getActiveOperatorRun();
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

  return (
    <OpsShell
      title="Platform horizon"
      eyebrow="Future scope · intentionally non-interactive"
      operator={context.operator}
      room={context.run}
    >
      <div className="rounded-2xl border border-[#d7d5cd] bg-white p-6">
        <p className="max-w-3xl leading-7 text-[#59654b]">
          These modules explain the wider platform direction. They are not
          implemented, enabled or represented as live capabilities in this
          limited production-grade slice.
        </p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {futureModules.map((module) => (
          <article
            key={module.name}
            className="rounded-2xl border border-[#d7d5cd] bg-white p-6"
          >
            <span className="rounded-full bg-[#eef0eb] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#59654b]">
              Future scope
            </span>
            <h2 className="font-display mt-4 text-2xl text-[#183f34]">
              {module.name}
            </h2>
            <p className="mt-3 text-sm leading-6">{module.scope}</p>
            <p className="mt-4 border-t border-[#e5e3dc] pt-4 text-xs leading-5 text-[#59654b]">
              Required before implementation: {module.dependency}
            </p>
          </article>
        ))}
      </div>
    </OpsShell>
  );
}
