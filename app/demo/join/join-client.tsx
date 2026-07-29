"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SupabaseDemoRunService } from "@/services/supabase/demo-run-service";

export function JoinClient({ token }: { token: string }) {
  const router = useRouter();
  const attempted = useRef(false);
  const [message, setMessage] = useState("Creating a private visitor session…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const service = new SupabaseDemoRunService();
    void service
      .joinRun({ opaqueJoinToken: token })
      .then((result) => {
        setMessage("Paired. Opening the Tràng An story…");
        router.replace(`/demo/qr/${encodeURIComponent(result.sourceCode)}`);
      })
      .catch((error: unknown) => {
        setFailed(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "This pairing link is invalid or expired.",
        );
      });
  }, [router, token]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#151a17] px-5 text-[#f4f0e7]">
      <section className="max-w-lg text-center">
        <div
          className={`mx-auto h-12 w-12 rounded-full border-2 ${
            failed
              ? "border-[#b9413e] bg-[#b9413e]/15"
              : "animate-pulse border-[#b18b52] bg-[#b18b52]/15"
          }`}
          aria-hidden="true"
        />
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.22em] text-[#d8b77d]">
          Ninh Bình Journey
        </p>
        <h1 className="font-display mt-3 text-4xl">
          {failed ? "Pairing could not be completed" : "Pairing visitor device"}
        </h1>
        <p className="mt-4 leading-7 text-white/68" role="status">
          {message}
        </p>
        {failed ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 min-h-11 rounded-full border border-white/25 px-5 font-semibold"
          >
            Retry
          </button>
        ) : null}
      </section>
    </main>
  );
}
