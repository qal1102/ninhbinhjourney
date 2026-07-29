import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/shared/brand-lockup";
import type { InternalRole } from "@/domain/models";

const nav = [
  { href: "/ops", label: "Overview" },
  { href: "/ops/bookings", label: "Bookings" },
  { href: "/ops/check-in", label: "Scan" },
  { href: "/ops/capacity", label: "Capacity" },
  { href: "/ops/incidents", label: "Incidents" },
  { href: "/ops/copilot", label: "Copilot" },
  { href: "/ops/modules", label: "More" },
] as const;

export function OpsShell({
  children,
  title,
  eyebrow,
  operator,
  room,
}: {
  children: ReactNode;
  title: string;
  eyebrow: string;
  operator: { email: string | null; role: InternalRole };
  room: { label: string; expiresAt: string };
}) {
  return (
    <main className="min-h-screen bg-[#eef0eb] text-[#151a17] lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-[#d7d5cd] bg-[#151a17] p-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10 lg:p-6">
        <BrandLockup href="/ops" inverse product="DestinationOS" />
        <p className="mt-2 text-xs text-white/45">
          Shared operations · illustrative demo data
        </p>
        <nav
          aria-label="DestinationOS"
          className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-xl px-4 py-3 text-sm font-bold text-white/72 transition hover:bg-white/8 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 rounded-2xl border border-white/12 bg-white/5 p-4 text-xs leading-5 lg:mt-10">
          <p className="font-bold text-[#e7c78d]">{operator.role}</p>
          <p className="mt-1 break-all text-white/55">
            {operator.email ?? "Named operator"}
          </p>
          <p className="mt-4 font-bold">{room.label}</p>
          <p className="mt-1 text-white/45">
            Expires {new Date(room.expiresAt).toLocaleString("vi-VN")}
          </p>
        </div>
      </aside>
      <div className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <header className="mx-auto max-w-7xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#59654b]">
            {eyebrow}
          </p>
          <h1 className="font-display mt-2 text-4xl sm:text-6xl">{title}</h1>
        </header>
        <div className="mx-auto mt-8 max-w-7xl">{children}</div>
      </div>
    </main>
  );
}
