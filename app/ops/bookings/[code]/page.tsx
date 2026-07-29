import { notFound, redirect } from "next/navigation";
import { can } from "@/domain/permissions";
import { DomainError } from "@/domain/errors";
import { createClient } from "@/lib/supabase/server";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { OpsShell } from "@/components/ops/ops-shell";

export default async function OpsBookingDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
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
  const { code } = await params;
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("demo_run_id", context.run.id)
    .eq("code", code)
    .single();
  if (!booking) notFound();
  const [
    { data: lines },
    { data: payment },
    { data: events },
    { data: pass },
    { data: audit },
    { data: contact },
  ] = await Promise.all([
    supabase.from("booking_lines").select("*").eq("booking_id", booking.id),
    supabase
      .from("payment_intents")
      .select("*")
      .eq("booking_id", booking.id)
      .single(),
    supabase
      .from("payment_events")
      .select("*")
      .eq("demo_run_id", context.run.id)
      .order("received_at"),
    supabase
      .from("passes")
      .select("*")
      .eq("booking_id", booking.id)
      .single(),
    supabase
      .from("audit_events")
      .select("*")
      .eq("demo_run_id", context.run.id)
      .or(`entity_id.eq.${booking.id},metadata->>bookingId.eq.${booking.id}`)
      .order("created_at"),
    can(context.operator.role, "view-full-demo-contact")
      ? supabase
          .from("booking_contacts")
          .select("contact_kind, contact_value, consent_at")
          .eq("booking_id", booking.id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const { data: entitlements } = pass
    ? await supabase
        .from("pass_entitlements")
        .select("*")
        .eq("pass_id", pass.id)
    : { data: [] };
  const { data: redemptions } = pass
    ? await supabase
        .from("redemptions")
        .select("*")
        .eq("pass_id", pass.id)
    : { data: [] };

  return (
    <OpsShell
      title={booking.code}
      eyebrow="Booking detail · masked by default"
      operator={context.operator}
      room={context.run}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#d7d5cd] bg-white p-5 sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-[#59654b]">Guest</p>
                <p className="mt-1 font-bold">{booking.customer_display_name}</p>
                <p className="mt-1 text-sm">{booking.masked_contact}</p>
                {contact ? (
                  <p className="mt-2 rounded-lg bg-[#fff7e9] p-2 text-xs">
                    Authorized full demo contact: {contact.contact_value}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-sm text-[#59654b]">Visit / party</p>
                <p className="mt-1 font-bold">
                  {booking.visit_date} · {booking.party_size} guests
                </p>
                <p className="mt-1 text-sm">{booking.status}</p>
              </div>
              <div>
                <p className="text-sm text-[#59654b]">Source attribution</p>
                <p className="mt-1 text-sm">
                  QR {booking.qr_source_id ?? "direct"} · campaign{" "}
                  {booking.campaign_id ?? "direct"}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#59654b]">Service-commerce total</p>
                <p className="mt-1 font-display text-2xl">
                  {can(context.operator.role, "view-service-commerce")
                    ? `${booking.total_vnd.toLocaleString("vi-VN")} VND`
                    : "Restricted"}
                </p>
              </div>
            </div>
            <h2 className="font-display mt-7 text-2xl">Lines</h2>
            <div className="mt-3 space-y-2">
              {(lines ?? []).map((line) => (
                <div
                  key={line.id}
                  className="flex justify-between gap-4 rounded-xl bg-[#f4f0e7] p-3 text-sm"
                >
                  <span>
                    Product {line.product_id.slice(0, 8)} · {line.quantity} ×{" "}
                    {line.unit_price_vnd.toLocaleString("vi-VN")}
                  </span>
                  <span>{line.ledger_type}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[#d7d5cd] bg-white p-5">
            <h2 className="font-display text-2xl">Pass & entitlements</h2>
            <p className="mt-2 text-sm text-[#59654b]">
              {pass?.status ?? "No pass"} · hint {pass?.token_hint ?? "—"}
            </p>
            <div className="mt-4 space-y-2">
              {(entitlements ?? []).map((item) => (
                <p key={item.id} className="rounded-xl bg-[#edf3f0] p-3 text-sm">
                  Site {item.site_id.slice(0, 8)} · {item.redeemed_quantity}/
                  {item.quantity}
                </p>
              ))}
              {(redemptions ?? []).map((item) => (
                <p key={item.id} className="rounded-xl bg-[#e6eee9] p-3 text-xs">
                  Redeemed {item.quantity} at{" "}
                  {new Date(item.created_at).toLocaleString("vi-VN")}
                </p>
              ))}
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="rounded-2xl bg-[#183f34] p-5 text-white">
            <h2 className="font-display text-2xl">Sandbox payment lifecycle</h2>
            <p className="mt-3 text-sm">
              {payment?.status ?? "unknown"} · {payment?.mode ?? "simulation"}
            </p>
            <p className="mt-1 break-all text-xs text-white/45">
              {payment?.provider_intent_id}
            </p>
            <ol className="mt-4 space-y-2 text-sm">
              {(events ?? [])
                .filter((event) => event.payment_intent_id === payment?.id)
                .map((event) => (
                  <li key={event.id} className="rounded-xl bg-white/7 p-3">
                    {event.event_type} · {event.provider_event_id}
                  </li>
                ))}
            </ol>
          </section>
          <section className="rounded-2xl border border-[#d7d5cd] bg-white p-5">
            <h2 className="font-display text-2xl">Audit timeline</h2>
            <ol className="mt-4 space-y-4">
              {(audit ?? []).map((event) => (
                <li key={event.id} className="border-l-2 border-[#a8cec1] pl-4">
                  <p className="text-sm font-bold">{event.action}</p>
                  <p className="mt-1 text-xs text-[#59654b]">
                    {new Date(event.created_at).toLocaleString("vi-VN")}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </OpsShell>
  );
}
