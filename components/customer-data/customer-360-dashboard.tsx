import type { Customer360Journey } from "@/lib/customer-data/journey-repository";
import { ngayVietNam, thoiLuongChu } from "@/domain/thoi-luong";
import type { Customer360BookingOrder } from "@/lib/customer-data/booking-repository";
import type { Customer360OutboundAction } from "@/lib/customer-data/recommendation-repository";
import { nhanCachTra } from "@/domain/customer-booking";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

// Vé web mang uuid cơ sở; màn soát vé đi theo tên cơ sở trong đường dẫn.
const CO_SO_THEO_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [uuid, slug]),
);
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
  // "19:14 12/10/2026": kiểu người Việt viết, không phải "19:14 12 thg 10, 2026".
  const phan = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(new Date(value));
  const lay = (loai: Intl.DateTimeFormatPartTypes) => phan.find((p) => p.type === loai)?.value ?? "";
  return `${lay("hour")}:${lay("minute")} ${lay("day")}/${lay("month")}/${lay("year")}`;
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

const SEGMENT_LABELS: Record<string, string> = {
  "marketing-reachable": "Nhận được tin giới thiệu",
  "identified-service-contact": "Đã để lại liên hệ",
};

const OUTBOUND_CHANNEL_LABELS: Record<Customer360OutboundAction["channel"], string> = {
  email: "email",
  sms: "tin nhắn SMS",
  zalo: "Zalo",
};

const OUTBOUND_STATUS_LABELS: Record<string, string> = {
  staged: "đang xếp hàng thử",
  suppressed: "đã chặn",
  "simulated-delivered": "đã gửi thử",
  failed: "gửi hỏng",
  "dead-letter": "gửi hỏng nhiều lần, đã dừng",
  cancelled: "đã huỷ",
};

const SUPPRESSION_REASON_LABELS: Record<string, string> = {
  "marketing-consent-required": "khách chưa đồng ý nhận thông tin giới thiệu",
  "frequency-cap": "khách đã nhận đủ số tin cho phép trong 7 ngày",
  "opted-out": "khách đã từ chối nhận tin",
};

/** Hồ sơ của lịch sử mẫu mang tiền tố de000000-: gọi là khách mẫu, không in mã. */
function shortCustomerId(profileId: string) {
  return profileId.startsWith("de000000") ? "mẫu" : profileId.slice(0, 8).toUpperCase();
}

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
          Màn hình khách hàng chưa được mở
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#6b6250]">
          {status === "disabled"
            ? "Phần lưu hành trình và đặt chỗ của khách chưa được bật, nên chưa có dữ liệu khách nào để xem ở đây. Việc bật do bộ phận kỹ thuật làm."
            : "Kho dữ liệu khách đang không trả lời, nên màn hình chưa hiện được gì. Chỗ trống này cố ý không điền số minh hoạ. Mời bạn tải lại sau ít phút; nếu vẫn vậy, xin báo bộ phận kỹ thuật."}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6" data-testid="customer-360-dashboard">
      <section className="rounded-3xl bg-[#173f34] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">
          Khách hàng
        </p>
        <h1 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">
          Khách và đơn của họ
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Khách đến từ đâu, thích gì, đã đặt gì, đồng ý cho dùng dữ liệu tới đâu. Email và số điện thoại được che; mỗi lần mở màn này đều ghi vào nhật ký.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Gợi ý dịch vụ</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">{recommendations.length}</p>
          <p className="mt-2 text-xs text-[#849089]">mỗi gợi ý ghi rõ vì sao, dựa trên điều khách đã tự chọn</p>
        </article>
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Tin chờ gửi cho khách</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">{outboundActions.length}</p>
          <p className="mt-2 text-xs text-[#849089]">mới xếp hàng thử, chưa gửi đi thật tin nào</p>
        </article>
      </section>

      {recommendations.length > 0 || outboundActions.length > 0 ? (
        <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607b70]">Gợi ý và tin giới thiệu</p>
          <h2 className="mt-2 text-2xl font-black text-[#203a30]">Gợi ý cho từng khách</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66756e]">Khách chưa đồng ý nhận tin, đã từ chối, hoặc đã nhận 2 tin trong 7 ngày thì không gửi thêm.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {recommendations.map((recommendation) => (
              <article key={recommendation.recommendationId} className="rounded-2xl border border-[#dfe7e2] bg-[#f7f9f7] p-4 text-sm text-[#42574e]">
                <strong>{recommendation.productName}</strong>
                <p className="mt-2">{RECOMMENDATION_REASON_LABELS[recommendation.reasonCode] ?? recommendation.reasonCode}</p>
                <p className="mt-2 text-xs">Khách {shortCustomerId(recommendation.profileId)} · gợi ý còn hạn tới {formatDate(recommendation.expiresAt)}</p>
              </article>
            ))}
            {outboundActions.map((action) => (
              <article key={action.actionId} className="rounded-2xl border border-[#eadcc4] bg-[#fff8eb] p-4 text-sm text-[#5d5037]">
                <strong>Tin qua {OUTBOUND_CHANNEL_LABELS[action.channel] ?? action.channel} · {OUTBOUND_STATUS_LABELS[action.status] ?? action.status}</strong>
                <p className="mt-2">{action.suppressionReason ? `Đã chặn vì ${SUPPRESSION_REASON_LABELS[action.suppressionReason] ?? action.suppressionReason}.` : "Đang xếp hàng thử, chưa gửi qua nhà mạng hay dịch vụ nào."}</p>
                <p className="mt-2 text-xs">Khách {shortCustomerId(action.profileId)} · mẫu tin {action.templateCode} · {formatDate(action.createdAt)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Hành trình đã lưu</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">{journeys.length}</p>
          <p className="mt-2 text-xs text-[#849089]">khách tự lập ở trang Lập hành trình</p>
        </article>
        <article className="rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm">
          <p className="text-xs text-[#6e7b75]">Đơn đặt chỗ</p>
          <p className="mt-2 text-3xl font-black text-[#203a30]">
            {orders.length}
          </p>
          <p className="mt-2 text-xs text-[#849089]">đơn đặt trên web, kèm vé đã phát</p>
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
          <p className="mt-2 text-xs text-[#849089]">lượt xem, bấm, cuộn mà khách cho phép ghi</p>
        </article>
      </section>

      {orders.length > 0 ? (
        <section
          className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"
          data-chi="don-web"
          data-chi-loi={"Mỗi thẻ là một đơn web, đơn mới nhất đứng đầu. Bấm \"Xem như khách\" để thấy hộ chiếu khách ấy đang cầm."}
        >
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607b70]">Đặt chỗ trên web · mọi khách đã có đơn</p>
          <h2 className="mt-2 text-2xl font-black text-[#203a30]">Đơn, tiền và vé của từng khách</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {orders.map((order, thuTuDon) => (
              <article
                key={order.orderId}
                className="rounded-2xl border border-[#dfe7e2] bg-[#f7f9f7] p-4 text-sm text-[#42574e]"
                // Màn Hướng dẫn: đơn mới nhất là đơn người trình diễn vừa đặt.
                {...(thuTuDon === 0
                  ? {
                      "data-chi": "don-moi",
                      "data-chi-loi": `Đơn mới nhất ${order.orderCode} ghi "${nhanCachTra(order.paymentMode, order.paymentStatus)}". Mã vé nằm ngay dưới.`,
                    }
                  : {})}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <strong>{order.productName}</strong>
                    <p className="mt-1 text-xs">
                      {order.orderCode} · khách {shortCustomerId(order.profileId)} ·{" "}
                      <a href={`?xem=${order.profileId}#khach-thay-gi`} className="font-bold text-[#35594b] underline underline-offset-2">Xem như khách</a>
                    </p>
                    <p className="mt-1 text-xs">Ngày đi {ngayVietNam(order.visitDate)} · {order.partySize} khách · đặt lúc {formatDate(order.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-[#e7efe9] px-2.5 py-1 text-xs font-bold text-[#35594b]">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
                </div>
                <p className="mt-3 font-bold">{order.totalVnd.toLocaleString("vi-VN")} VND · <span data-cach-tra={order.paymentMode ?? ""}>{nhanCachTra(order.paymentMode, order.paymentStatus)}</span></p>
                {order.tickets.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {/* Bấm mã vé là mở màn soát vé đúng cơ sở, mã điền sẵn: trình
                        diễn "khách tới cổng" không phải gõ tay mười sáu ký tự. */}
                    {order.tickets.map((ticket) => {
                      const coSo = CO_SO_THEO_UUID.get(ticket.siteId);
                      const nhan = `${ticket.ticketCode} · ${ticket.entriesAllowed} lượt`;
                      return coSo ? (
                        <a
                          key={ticket.ticketCode}
                          href={`/erp/${coSo}/check-in-khach?ma=${encodeURIComponent(ticket.ticketCode)}`}
                          title="Mở màn soát vé với mã này"
                          {...(thuTuDon === 0
                            ? { "data-chi": "ma-ve", "data-chi-loi": "Bấm mã vé này. Màn soát vé mở ra với mã điền sẵn." }
                            : {})}
                          className="inline-flex min-h-11 items-center rounded-lg bg-[#173f34] px-3 text-xs font-bold text-[#e7c78d] underline-offset-2 hover:underline"
                        >
                          <code>{nhan}</code>
                          <span aria-hidden="true" className="ml-1.5">→ quét</span>
                        </a>
                      ) : (
                        <code key={ticket.ticketCode} className="rounded-lg bg-[#173f34] px-2.5 py-1.5 text-xs font-bold text-[#e7c78d]">{nhan}</code>
                      );
                    })}
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
                    {journey.intent.pace === "relaxed" ? "Đi thong thả" : journey.intent.pace === "active" ? "Đi được nhiều" : "Đi vừa phải"}
                    {" · "}{thoiLuongChu(journey.intent.duration_minutes)}
                    {" · "}ngày đi {ngayVietNam(journey.intent.visit_date)}
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
                          <span key={segment} className="rounded-full bg-[#e7efe9] px-3 py-1 text-xs font-bold text-[#35594b]">{SEGMENT_LABELS[segment] ?? segment}</span>
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
