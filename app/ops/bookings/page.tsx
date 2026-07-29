import Link from "next/link";
import { redirect } from "next/navigation";
import { DomainError } from "@/domain/errors";
import { createClient } from "@/lib/supabase/server";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { OpsShell } from "@/components/ops/ops-shell";

export default async function OpsBookingsPage({
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
      "finance",
      "admin",
    ]);
  } catch (error) {
    if (error instanceof DomainError && error.code === "PERMISSION_DENIED") {
      redirect("/ops/login");
    }
    redirect("/ops/settings/demo");
  }
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const query = typeof params.q === "string" ? params.q : "";
  const supabase = await createClient();
  let bookingsQuery = supabase
    .from("bookings")
    .select("*")
    .eq("demo_run_id", context.run.id)
    .order("created_at", { ascending: false });
  if (status) bookingsQuery = bookingsQuery.eq("status", status);
  if (query) bookingsQuery = bookingsQuery.ilike("code", `%${query}%`);
  const { data: bookings } = await bookingsQuery;

  return (
    <OpsShell
      title="Bookings"
      eyebrow="Masked list · run-scoped"
      operator={context.operator}
      room={context.run}
    >
      <form className="grid gap-3 rounded-2xl border border-[#d7d5cd] bg-white p-4 sm:grid-cols-[1fr_14rem_auto]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search booking code"
          className="min-h-11 rounded-xl border border-[#c9ccc5] px-4"
        />
        <select
          name="status"
          defaultValue={status}
          className="min-h-11 rounded-xl border border-[#c9ccc5] bg-white px-4"
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="partially-used">Partially used</option>
          <option value="used">Used</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="min-h-11 rounded-full bg-[#183f34] px-5 font-bold text-white">
          Filter
        </button>
      </form>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-[#d7d5cd] bg-white">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-[#f4f0e7] text-xs uppercase tracking-[0.12em] text-[#59654b]">
            <tr>
              <th className="p-4">Code</th>
              <th className="p-4">Guest</th>
              <th className="p-4">Visit</th>
              <th className="p-4">Party</th>
              <th className="p-4">Status</th>
              <th className="p-4">Source</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((booking) => (
              <tr key={booking.id} className="border-t border-[#e5e3dc]">
                <td className="p-4">
                  <Link
                    href={`/ops/bookings/${booking.code}`}
                    className="font-bold text-[#356957] underline underline-offset-4"
                  >
                    {booking.code}
                  </Link>
                </td>
                <td className="p-4">
                  <p>{booking.customer_display_name}</p>
                  <p className="mt-1 text-xs text-[#59654b]">
                    {booking.masked_contact}
                  </p>
                </td>
                <td className="p-4">{booking.visit_date}</td>
                <td className="p-4">{booking.party_size}</td>
                <td className="p-4">{booking.status}</td>
                <td className="p-4 text-xs">
                  {booking.qr_source_id ? "Attributed QR" : "Direct"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(bookings ?? []).length === 0 ? (
          <p className="p-8 text-center text-sm text-[#59654b]">
            No bookings match this room filter.
          </p>
        ) : null}
      </div>
    </OpsShell>
  );
}
