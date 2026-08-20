import type { Customer360Journey } from "@/lib/customer-data/journey-repository";
import type { Customer360BookingOrder } from "@/lib/customer-data/booking-repository";
import type { Customer360OutboundAction } from "@/lib/customer-data/recommendation-repository";
import { RECOMMENDATION_REASON_LABELS, type CustomerRecommendation } from "@/domain/customer-recommendations";

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

function profileLabel(journey: Customer360Journey) {
  if (journey.contactTypes.length === 0) return anonymousLabel(journey.profileId);
  const labels = journey.contactTypes.map((type) =>
    type === "email" ? "email đã bảo vệ" : "số điện thoại đã bảo vệ",
  );
  return `Khách đã chủ động để lại ${labels.join(" + ")}`;
}

const CONSENT_LABELS: Record<string, string> = {
  essential_service: "Phục vụ hành trình",
  product_analytics: "Phân tích trải nghiệm",
  marketing_communications: "Thông tin giới thiệu",
};

const CONSENT_STATUS_LABELS: Record<string, string> = {
  granted: "Đã đồng ý",
  denied: "Không đồng ý",
  revoked: "Đã rút lại",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  holding: "Đang giữ chỗ",
  confirmed: "Đã xác nhận",
  expired: "Đã hết hạn",
  cancelled: "Đã hủy",
};

export function Customer360Dashboard({
  status,
  journeys = [],
  orders = [],
  recommendations = [],
  outboundActions = [],
}: {
  status: "disabled" | "unavailable" | "ready";
  journeys?: readonly Customer360Journey[];
  orders?: readonly Customer360BookingOrder[];
  recommendations?: readonly CustomerRecommendation[];
  outboundActions?: readonly Customer360OutboundAction[];
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
            ? "Màn hình chỉ mở sau khi migration lớp khách hàng được áp dụng và ít nhất một cờ hành trình/booking được bật. Hiện không có dữ liệu khách thật nào được thu từ màn hình này."
            : "Kho hành trình đang chưa phản hồi. Không thay bằng số minh hoạ; hãy kiểm tra migration và cấu hình máy chủ trước khi dùng."}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6" data-testid="customer-360-dashboard">
      <section className="rounded-3xl bg-[#173f34] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">
          Customer 360 · định danh tăng dần
        </p>
        <h1 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">
          Hành trình khách đã chủ động tạo
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Nguồn vào, sở thích, lịch trình, quyền sử dụng dữ liệu và liên hệ đã bảo vệ được đặt cùng một dòng thời gian. Gợi ý chỉ dùng lựa chọn rõ ràng của khách, luôn hiện lý do và phiên bản rule. Màn hình không có đường giải mã email hay số điện thoại; mỗi lần mở đều ghi audit.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Gợi ý có thể giải thích</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">{recommendations.length}</p>
          <p className="mt-2 text-xs text-[#849089]">rule version + reason code, không gọi là AI</p>
        </article>
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Hàng đợi outbound</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">{outboundActions.length}</p>
          <p className="mt-2 text-xs text-[#849089]">chỉ staged/suppressed mô phỏng, chưa gửi ra nhà cung cấp</p>
        </article>
      </section>

      {recommendations.length > 0 || outboundActions.length > 0 ? (
        <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607b70]">Gợi ý & hành động marketing · kiểm soát được</p>
          <h2 className="mt-2 text-2xl font-black text-[#203a30]">Lý do trước, gửi ra ngoài sau</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66756e]">Không có email, số điện thoại hay nội dung liên hệ ở đây. Hành động sẽ bị suppress nếu chưa có consent marketing hiện hành, đã opt-out hoặc quá 2 lần/7 ngày/kênh.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {recommendations.map((recommendation) => (
              <article key={recommendation.recommendationId} className="rounded-2xl border border-[#dfe7e2] bg-[#f7f9f7] p-4 text-sm text-[#42574e]">
                <strong>{recommendation.productName}</strong>
                <p className="mt-2">{RECOMMENDATION_REASON_LABELS[recommendation.reasonCode] ?? recommendation.reasonCode}</p>
                <p className="mt-2 text-xs">profile {recommendation.profileId.slice(0, 8).toUpperCase()} · rule {recommendation.ruleVersion} · hết hạn {formatDate(recommendation.expiresAt)}</p>
              </article>
            ))}
            {outboundActions.map((action) => (
              <article key={action.actionId} className="rounded-2xl border border-[#eadcc4] bg-[#fff8eb] p-4 text-sm text-[#5d5037]">
                <strong>Outbound {action.channel.toUpperCase()} · {action.status}</strong>
                <p className="mt-2">{action.suppressionReason ? `Đã chặn: ${action.suppressionReason}` : "Đang ở hàng đợi mô phỏng; không có provider nào được gọi."}</p>
                <p className="mt-2 text-xs">profile {action.profileId.slice(0, 8).toUpperCase()} · template {action.templateCode} · {formatDate(action.createdAt)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Hành trình đã lưu</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">{journeys.length}</p>
          <p className="mt-2 text-xs text-[#849089]">nguồn: customer_journeys</p>
        </article>
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Đơn dịch vụ đã nối</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">
            {orders.length}
          </p>
          <p className="mt-2 text-xs text-[#849089]">order + payment mô phỏng + vé T8</p>
        </article>
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Hồ sơ có liên hệ bảo vệ</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">
            {new Set(journeys.filter((journey) => journey.contactTypes.length > 0).map((journey) => journey.profileId)).size}
          </p>
          <p className="mt-2 text-xs text-[#849089]">chỉ hiện loại liên hệ, không hiện giá trị</p>
        </article>
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Tín hiệu hành vi đã ghi</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">
            {journeys.reduce((total, journey) => total + journey.events.length, 0)}
          </p>
          <p className="mt-2 text-xs text-[#849089]">nguồn: customer_events</p>
        </article>
      </section>

      {orders.length > 0 ? (
        <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607b70]">Bán dịch vụ · toàn bộ profile có order</p>
          <h2 className="mt-2 text-2xl font-black text-[#203a30]">Order, payment mô phỏng và vé T8</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {orders.map((order) => (
              <article key={order.orderId} className="rounded-2xl border border-[#dfe7e2] bg-[#f7f9f7] p-4 text-sm text-[#42574e]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <strong>{order.productName}</strong>
                    <p className="mt-1 text-xs">{order.orderCode} · profile {order.profileId.slice(0, 8).toUpperCase()}</p>
                    <p className="mt-1 text-xs">{order.visitDate} · {order.partySize} khách · {formatDate(order.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-[#e7efe9] px-2.5 py-1 text-xs font-bold text-[#35594b]">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
                </div>
                <p className="mt-3 font-bold">{order.totalVnd.toLocaleString("vi-VN")} VND · {order.paymentStatus === "succeeded" ? "payment mô phỏng thành công" : "chưa có payment"}</p>
                {order.tickets.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.tickets.map((ticket) => <code key={ticket.ticketCode} className="rounded-lg bg-[#173f34] px-2.5 py-1.5 text-xs font-bold text-[#e7c78d]">{ticket.ticketCode} · {ticket.entriesAllowed} lượt</code>)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
                    {profileLabel(journey)}
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
                  <div className="mt-5">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#738078]">Quyền sử dụng dữ liệu</p>
                    <ul className="mt-3 space-y-2 text-sm text-[#42574e]">
                      {Object.entries(journey.consents).length === 0 ? (
                        <li className="rounded-xl bg-[#f7f9f7] px-3 py-2">Chưa có lựa chọn được ghi ở máy chủ.</li>
                      ) : Object.entries(journey.consents).map(([purpose, consent]) => (
                        <li key={purpose} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f9f7] px-3 py-2">
                          <span>{CONSENT_LABELS[purpose] ?? purpose}</span>
                          <strong>{CONSENT_STATUS_LABELS[consent.status] ?? consent.status}</strong>
                        </li>
                      ))}
                    </ul>
                    {journey.segments.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {journey.segments.map((segment) => (
                          <span key={segment} className="rounded-full bg-[#e7efe9] px-3 py-1 text-xs font-bold text-[#35594b]">{segment}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
                    {journey.deliveryRequests.map((request) => (
                      <li key={`${request.channel}-${request.createdAt}`} className="flex gap-3 rounded-xl bg-[#fff8eb] px-3 py-2 text-sm text-[#5d5037]">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#d58c35]" />
                        <span><strong>Đã lưu yêu cầu nhận hành trình qua {request.channel === "sms" ? "SMS" : "email"}</strong> · {formatDate(request.createdAt)} · chưa gửi ra ngoài</span>
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
