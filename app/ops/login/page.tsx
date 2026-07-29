import Link from "next/link";
import { readPublicEnvironment } from "@/config/experience";
import { SetupState } from "@/components/shared/setup-state";
import { LoginForm } from "./login-form";

export default function OperatorLoginPage() {
  const environment = readPublicEnvironment();
  if (environment.status !== "ready") {
    return (
      <SetupState
        environment={environment}
        surface="Operator sign-in"
        demoHref="/demo/ops"
      />
    );
  }

  return (
    <main className="grid min-h-screen bg-[#111a17] px-5 py-10 text-[#f4f0e7] lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:p-8">
      <section className="relative hidden overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,#214d3c,#111a17_72%)] p-10 lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#d8b77d]">
            Live — Production-grade pilot scope
          </p>
          <h1 className="font-display mt-5 max-w-2xl text-6xl leading-[0.96]">
            Destination commerce and operations, in one accountable flow.
          </h1>
        </div>
        <div className="max-w-xl rounded-2xl border border-white/10 bg-black/15 p-6">
          <p className="text-sm font-semibold text-[#d8b77d]">Access boundary</p>
          <p className="mt-2 leading-7 text-white/72">
            Internal actions require a named Supabase Auth account, active tenant
            membership, server checks, and PostgreSQL RLS. Persona preview never
            grants authority.
          </p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-lg flex-col justify-center py-10">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#d8b77d]">
          DestinationOS
        </p>
        <h2 className="font-display mt-3 text-5xl">Operator sign-in</h2>
        <p className="mt-4 leading-7 text-white/65">
          Use the named demonstration operator account managed in Supabase Auth.
          Anonymous visitor sessions cannot access this surface.
        </p>
        <LoginForm />
        <Link href="/" className="mt-7 text-sm font-semibold text-white/65 underline-offset-4 hover:underline">
          Back to Ninh Bình Journey
        </Link>
      </section>
    </main>
  );
}
