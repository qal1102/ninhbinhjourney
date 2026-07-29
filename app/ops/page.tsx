import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/domain/permissions";
import { DomainError } from "@/domain/errors";
import { createClient } from "@/lib/supabase/server";
import { getActiveOperatorRun } from "@/lib/auth/operator";
import { OpsShell } from "@/components/ops/ops-shell";

export default async function OpsOverviewPage() {
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
    if (
      error instanceof DomainError &&
      (error.code === "DEMO_ROOM_NOT_JOINED" ||
        error.code === "DEMO_ROOM_EXPIRED")
    ) {
      redirect("/ops/settings/demo");
    }
    throw error;
  }
  const supabase = await createClient();
  const [
    { data: bookings },
    { data: slots },
    { data: incidents },
    { data: activity },
    { data: analytics },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .eq("demo_run_id", context.run.id)
      .eq("visit_date", "2026-08-15"),
    supabase
      .from("capacity_slots")
      .select("*")
      .eq("demo_run_id", context.run.id)
      .eq("slot_date", "2026-08-15"),
    supabase
      .from("incidents")
      .select("id, site_id, severity, status")
      .eq("demo_run_id", context.run.id)
      .neq("status", "closed"),
    supabase
      .from("audit_events")
      .select("id, action, entity_type, created_at")
      .eq("demo_run_id", context.run.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("analytics_events")
      .select("campaign_id, qr_source_id, event_type")
      .eq("demo_run_id", context.run.id)
      .eq("event_type", "booking.created"),
  ]);
  const visibleBookings = bookings ?? [];
  const guests = visibleBookings.reduce(
    (total, booking) => total + booking.party_size,
    0,
  );
  const checkedIn = (slots ?? []).reduce(
    (total, slot) => total + slot.checked_in,
    0,
  );
  const gross = visibleBookings.reduce(
    (total, booking) => total + booking.total_vnd,
    0,
  );
  const role = context.operator.role;
  const prioritySites = [
    {
      id: "10000000-0000-4000-8000-000000000003",
      name: "Bái Đính",
      note: "Quần thể tâm linh · điều phối khách theo ca",
    },
    {
      id: "10000000-0000-4000-8000-000000000009",
      name: "Tam Chúc",
      note: "Khu hồ và tâm linh · phối hợp liên cơ sở",
    },
  ] as const;

  const siteNames = new Map<string, string>(
    prioritySites.map((site) => [site.id, site.name]),
  );
  const siteSnapshots = prioritySites.map((site) => {
    const siteSlots = (slots ?? []).filter((slot) => slot.site_id === site.id);
    const capacity = siteSlots.reduce((total, slot) => total + slot.capacity, 0);
    const reserved = siteSlots.reduce((total, slot) => total + slot.reserved, 0);
    const siteCheckedIn = siteSlots.reduce(
      (total, slot) => total + slot.checked_in,
      0,
    );
    const openIncidents = (incidents ?? []).filter(
      (incident) => incident.site_id === site.id,
    );
    const utilization = capacity > 0 ? Math.round((reserved / capacity) * 100) : 0;

    return {
      ...site,
      capacity,
      reserved,
      checkedIn: siteCheckedIn,
      openIncidents: openIncidents.length,
      utilization,
      hasData: siteSlots.length > 0,
      attention:
        openIncidents.some((incident) => ["P1", "P2"].includes(incident.severity)) ||
        utilization >= 85,
    };
  });

  const metrics = [
    {
      label: "Đơn đặt hôm nay",
      value: visibleBookings.length.toLocaleString("vi-VN"),
      href: "/ops/bookings?date=2026-08-15",
    },
    {
      label: "Khách dự kiến",
      value: guests.toLocaleString("vi-VN"),
      href: "/ops/bookings?date=2026-08-15",
    },
    {
      label: "Đã check-in",
      value: checkedIn.toLocaleString("vi-VN"),
      href: "/ops/check-in",
    },
    {
      label: "Doanh thu mô phỏng",
      value: can(role, "view-service-commerce")
        ? `${gross.toLocaleString("vi-VN")} VND`
        : "Giới hạn theo vai trò",
      href: can(role, "view-service-commerce")
        ? "/ops/bookings?ledger=service-commerce"
        : "/ops/modules",
    },
    {
      label: "Sự cố đang mở",
      value: (incidents ?? []).length.toLocaleString("vi-VN"),
      href: "/ops/incidents?status=open",
    },
    {
      label: "Đơn có nguồn quy thuộc",
      value: (analytics ?? []).length.toLocaleString("vi-VN"),
      href: "/ops/bookings?source=attributed",
    },
  ];

  return (
    <OpsShell
      title="Trung tâm điều hành"
      eyebrow="Tam Chúc · Bái Đính · một phòng dữ liệu dùng chung"
      operator={context.operator}
      room={context.run}
    >
      <section className="rounded-3xl bg-[#183f34] p-5 text-white sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#a8cec1]">
              Executive two-site command
            </p>
            <h2 className="font-display mt-3 text-3xl sm:text-5xl">
              Một màn hình, hai cơ sở.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/58">
            Tất cả số bên dưới thuộc phòng demo hiện tại, không phải dữ liệu vận
            hành thật.
          </p>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {siteSnapshots.map((site) => (
            <article
              key={site.id}
              className="rounded-2xl border border-white/12 bg-white/[0.06] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/48">
                    Operating site
                  </p>
                  <h3 className="font-display mt-2 text-3xl">{site.name}</h3>
                  <p className="mt-1 text-sm text-white/54">{site.note}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                    site.attention
                      ? "bg-[#f2c6bd] text-[#702a23]"
                      : "bg-[#dceee6] text-[#24594a]"
                  }`}
                >
                  {site.attention ? "Cần chú ý" : "Trong ngưỡng"}
                </span>
              </div>
              {site.hasData ? (
                <>
                  <div className="mt-6 grid grid-cols-3 gap-3 border-y border-white/10 py-4">
                    <div>
                      <p className="text-xs text-white/46">Đã đặt</p>
                      <p className="mt-1 text-xl font-bold">{site.reserved}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/46">Check-in</p>
                      <p className="mt-1 text-xl font-bold">{site.checkedIn}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/46">Sự cố mở</p>
                      <p className="mt-1 text-xl font-bold">{site.openIncidents}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-white/58">
                      <span>Sử dụng sức chứa</span>
                      <span>
                        {site.reserved}/{site.capacity} · {site.utilization}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${
                          site.attention ? "bg-[#e7b96a]" : "bg-[#8fc6b5]"
                        }`}
                        style={{ width: `${Math.min(100, site.utilization)}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-6 rounded-xl border border-dashed border-white/18 p-4 text-sm text-white/58">
                  Chưa có ca sức chứa trong phòng demo này. Tạo phòng mới sau khi
                  áp dụng migration để nạp dữ liệu cơ sở.
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="rounded-2xl border border-[#d7d5cd] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm text-[#59654b]">{metric.label}</p>
            <p className="font-display mt-3 text-3xl text-[#183f34]">
              {metric.value}
            </p>
          </Link>
        ))}
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-[#d7d5cd] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Sức chứa theo ca</h2>
            <Link href="/ops/capacity" className="text-sm font-bold text-[#356957]">
              Quản lý
            </Link>
          </div>
          <div className="mt-5 space-y-4">
            {(slots ?? []).map((slot) => {
              const utilization =
                slot.capacity > 0
                  ? Math.round((slot.reserved / slot.capacity) * 100)
                  : 0;
              return (
                <div key={slot.id}>
                  <div className="flex justify-between text-sm">
                    <span>
                      {siteNames.get(slot.site_id) ?? "Điểm khác"} ·{" "}
                      {slot.start_time.slice(0, 5)}
                    </span>
                    <span>
                      {slot.reserved}/{slot.capacity} · {slot.status}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e7e8e3]">
                    <div
                      className="h-full rounded-full bg-[#3f7568]"
                      style={{ width: `${Math.min(100, utilization)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-[#d7d5cd] bg-white p-5">
          <h2 className="font-display text-2xl">Hoạt động gần đây</h2>
          <ol className="mt-5 space-y-4">
            {(activity ?? []).map((event) => (
              <li key={event.id} className="border-l-2 border-[#a8cec1] pl-4">
                <p className="text-sm font-bold">{event.action}</p>
                <p className="mt-1 text-xs text-[#59654b]">
                  {event.entity_type} ·{" "}
                  {new Date(event.created_at).toLocaleString("vi-VN")}
                </p>
              </li>
            ))}
            {(activity ?? []).length === 0 ? (
              <li className="text-sm text-[#59654b]">
                Phòng demo chưa có hoạt động.
              </li>
            ) : null}
          </ol>
        </div>
      </section>
    </OpsShell>
  );
}
