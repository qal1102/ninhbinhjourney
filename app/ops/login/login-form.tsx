"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError("Sign-in failed. Check the named operator account and try again.");
        return;
      }
      router.replace("/ops/settings/demo");
      router.refresh();
    } catch {
      setError("DestinationOS authentication is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="operator-email" className="text-sm font-semibold">
          Operator email
        </label>
        <input
          id="operator-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 outline-none transition focus:border-[#b18b52]"
        />
      </div>
      <div>
        <label htmlFor="operator-password" className="text-sm font-semibold">
          Password
        </label>
        <input
          id="operator-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 outline-none transition focus:border-[#b18b52]"
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-[#b9413e]/15 p-4 text-sm text-[#ffd6d3]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-full bg-[#f4f0e7] px-5 font-bold text-[#151a17] transition hover:bg-white disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Signing in…" : "Sign in to DestinationOS"}
      </button>
    </form>
  );
}
