import { redirect } from "next/navigation";
import { readPublicEnvironment } from "@/config/experience";
import { SetupState } from "@/components/shared/setup-state";
import { DomainError } from "@/domain/errors";
import { getAuthenticatedOperator } from "@/lib/auth/operator";
import { DemoRoomControl } from "./demo-room-control";

export default async function DemoSettingsPage() {
  const environment = readPublicEnvironment();
  if (environment.status !== "ready") {
    return <SetupState environment={environment} surface="Demo room controls" />;
  }
  if (environment.config.mode !== "client-demo") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f0e7] px-5">
        <section className="max-w-xl rounded-2xl border border-[#d7d5cd] bg-white p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#59654b]">
            Production mode
          </p>
          <h1 className="font-display mt-3 text-4xl">Demo controls are disabled</h1>
          <p className="mt-4 leading-7 text-[#59654b]">
            Persona preview, sandbox checkout, isolated-room reset and concept
            presentation controls are unavailable in production mode.
          </p>
        </section>
      </main>
    );
  }

  let operator;
  try {
    operator = await getAuthenticatedOperator(["admin"]);
  } catch (error) {
    if (error instanceof DomainError && error.code === "PERMISSION_DENIED") {
      redirect("/ops/login");
    }
    throw error;
  }

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-8 text-[#151a17] sm:px-8 lg:px-12">
      <header className="mx-auto max-w-7xl border-b border-[#d7d5cd] pb-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#59654b]">
              DestinationOS · Client demonstration
            </p>
            <h1 className="font-display mt-2 text-4xl sm:text-6xl">
              Room & presenter controls
            </h1>
          </div>
          <div className="rounded-full border border-[#7d9b98] bg-white px-4 py-2 text-sm font-semibold">
            Live — Production-grade pilot scope
          </div>
        </div>
        <p className="mt-5 max-w-3xl leading-7 text-[#59654b]">
          Create one isolated run, pair an anonymous visitor, verify Realtime,
          rehearse the connected flows, then reset only that room.
        </p>
      </header>
      <div className="mx-auto mt-8 max-w-7xl">
        <DemoRoomControl operator={operator} />
      </div>
    </main>
  );
}
