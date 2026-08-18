import type { Customer360Journey } from "@/lib/customer-data/journey-repository";

const EVENT_LABELS: Record<string, string> = {
  page_viewed: "Mở trang",
  section_viewed: "Đã xem một phần nội dung",
  section_engaged: "Dừng xem nội dung",
  scroll_depth_reached: "Cuộn trang",
  content_clicked: "Chọn nội dung",
  destination_viewed: "Xem điểm đến",
  service_viewed: "Xem dịch vụ",
  plan_started: "Bắt đầu lập hành trình",
  plan_generated: "Tạo hành trình",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function sourceLabel(source: Customer360Journey["source"]) {
  return (
    source.utm_campaign ??
    source.utm_source ??
    source.partner_id ??
    source.qr_source_id ??
    (source.referrer_class === "external" ? "Nguồn ngoài hệ thống" : "Truy cập trực tiếp")
  );
}

function anonymousLabel(profileId: string) {
  return `Khách ẩn danh · ${profileId.slice(0, 8).toUpperCase()}`;
}

export function Customer360Dashboard({
  status,
  journeys = [],
}: {
  status: "disabled" | "unavailable" | "ready";
  journeys?: readonly Customer360Journey[];
}) {
  if (status !== "ready") {
    return (
      <section className="rounded-3xl border border-[#e0d6c4] bg-[#fdf8ef] p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6b27]">
          Dữ liệu khách hàng · giai đoạn thử nghiệm
        </p>
        <h1 className="font-display mt-3 text-4xl text-[#3d3325] sm:text-5xl">
          Customer 360 chưa được bật ở môi trường này
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#6b6250]">
          {status === "disabled"
            ? "Màn hình chỉ mở sau khi migration lớp khách hàng được áp dụng và cờ lưu hành trình được bật. Hiện không có dữ liệu khách thật nào được thu từ màn hình này."
            : "Kho hành trình đang chưa phản hồi. Không thay bằng số minh hoạ; hãy kiểm tra migration và cấu hình máy chủ trước khi dùng."}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6" data-testid="customer-360-dashboard">
      <section className="rounded-3xl bg-[#173f34] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">
          Customer 360 · chỉ dữ liệu ẩn danh
        </p>
        <h1 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">
          Hành trình khách đã chủ động tạo
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Nguồn vào, sở thích, lịch trình và hành vi đã có consent được đặt cùng một dòng thời gian. Không hiển thị số điện thoại, email hay dữ liệu marketing chưa được cấp quyền.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Hành trình đã lưu</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">{journeys.length}</p>
          <p className="mt-2 text-xs text-[#849089]">nguồn: customer_journeys</p>
        </article>
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Hồ sơ ẩn danh</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">
            {new Set(journeys.map((journey) => journey.profileId)).size}
          </p>
          <p className="mt-2 text-xs text-[#849089]">chưa suy diễn thành contact</p>
        </article>
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Tín hiệu hành vi đã ghi</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">
            {journeys.reduce((total, journey) => total + journey.events.length, 0)}
          </p>
          <p className="mt-2 text-xs text-[#849089]">nguồn: customer_events</p>
        </article>
      </section>

      {journeys.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-[#b8c6bf] bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-black text-[#294139]">Chưa có hành trình nào đủ điều kiện hiển thị</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6a7871]">
            Khi khách tự tạo lịch trình, hệ thống sẽ lưu bản tóm tắt ẩn danh có nguồn vào. Màn hình này không tự sinh dữ liệu để lấp chỗ trống.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {journeys.map((journey) => (
            <article
              key={journey.journeyId}
              className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col gap-4 border-b border-[#e8eeea] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607b70]">
                    {anonymousLabel(journey.profileId)}
                  </p>
                  <h2 className="mt-2 text-xl font-black text-[#203a30]">
                    {journey.intent.interests.length > 0
                      ? journey.intent.interests.join(" · ")
                      : "Chưa chọn sở thích"}
                  </h2>
                  <p className="mt-1 text-sm text-[#66756e]">
                    {journey.intent.pace === "relaxed" ? "Nhịp thư thả" : journey.intent.pace === "active" ? "Nhịp năng động" : "Nhịp cân bằng"}
                    {" · "}{journey.intent.duration_minutes} phút
                    {" · "}{journey.intent.visit_date}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f2f6f3] px-3 py-2 text-sm font-bold text-[#36584b]">
                  {sourceLabel(journey.source)}
                </div>
              </div>

              <div className="mt-4 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#738078]">Lịch trình đã tạo</p>
                  <ol className="mt-3 space-y-2 text-sm text-[#42574e]">
                    {journey.itinerary.items.map((item, index) => (
                      <li key={`${item.site_id}-${item.start_at}`} className="rounded-xl bg-[#f7f9f7] px-3 py-2">
                        Điểm {index + 1} · {new Date(item.start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#738078]">Dòng thời gian</p>
                  <ol className="mt-3 space-y-2">
                    <li className="flex gap-3 rounded-xl bg-[#f7f9f7] px-3 py-2 text-sm text-[#42574e]">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2d7058]" />
                      <span><strong>Tạo hành trình</strong> · {formatDate(journey.createdAt)}</span>
                    </li>
                    {journey.events.map((event) => (
                      <li key={`${event.eventName}-${event.occurredAt}`} className="flex gap-3 rounded-xl bg-[#f7f9f7] px-3 py-2 text-sm text-[#42574e]">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#b58a35]" />
                        <span><strong>{EVENT_LABELS[event.eventName] ?? event.eventName}</strong> · {formatDate(event.occurredAt)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
