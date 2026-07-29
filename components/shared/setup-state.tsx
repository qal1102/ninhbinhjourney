import Link from "next/link";
import type { PublicEnvironment } from "@/config/experience";

export function SetupState({
  environment,
  surface = "Shared data core",
  demoHref,
}: {
  environment: Extract<PublicEnvironment, { status: "missing" }>;
  surface?: string;
  demoHref?: string;
}) {
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <main className="grid min-h-screen place-items-center bg-[#111a17] px-5 py-12 text-[#f4f0e7]">
      <section
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-10"
        aria-labelledby="setup-title"
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#b18b52]">
          {isProduction ? "Service unavailable" : "Local setup required"}
        </p>
        <h1 id="setup-title" className="font-display mt-3 text-4xl sm:text-5xl">
          {surface} is not connected
        </h1>
        <p className="mt-5 max-w-xl leading-7 text-white/72">
          DestinationOS requires the dedicated Supabase project for authoritative,
          multi-device state. No browser-only database has been selected.
        </p>

        {environment.missing.length > 0 ? (
          <div className="mt-7 rounded-xl border border-[#b18b52]/35 bg-[#b18b52]/10 p-5">
            <h2 className="font-semibold">Missing configuration names</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/78">
              {environment.missing.map((name) => (
                <li key={name}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {environment.issues.length > 0 ? (
          <div className="mt-5 rounded-xl border border-[#b9413e]/40 bg-[#b9413e]/10 p-5">
            <h2 className="font-semibold">Invalid configuration</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/78">
              {environment.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-7 text-sm leading-6 text-white/62">
          Configure browser-safe values in <code>.env.local</code> using{" "}
          <code>.env.example</code>. Never place an operator password, database
          password, service-role key, or CLI token in a public variable.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          {demoHref ? (
            <Link
              href={demoHref}
              className="inline-flex min-h-11 items-center rounded-full bg-[#e7b96a] px-5 font-semibold text-[#183f34] transition hover:bg-[#f0c87c]"
            >
              Open executive demo
            </Link>
          ) : null}
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 font-semibold transition hover:bg-white/10"
          >
            Return to visitor story
          </Link>
        </div>
      </section>
    </main>
  );
}
