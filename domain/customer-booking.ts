import { z } from "zod";

/**
 * Số khách tối đa cho một lượt đặt trên web.
 *
 * Trần là **45**, và đó là quyết định kinh doanh của chủ dự án ở TC-15: đoàn
 * thật đi xe 32 chỗ, mà trần cũ 20 chặn đúng loại khách ấy. Migration
 * `202608300056_erp_visitor_groups_bus_size.sql` đã nới sáu ràng buộc dưới
 * cơ sở dữ liệu lên 45 cho khớp. **Đừng hạ xuống 20 lần nữa** — bản kiểm thử
 * ngày 12/09/2026 có đề nghị hạ, nhưng người viết chưa biết lịch sử này.
 *
 * Vẫn phải có trần, vì trần ở đây không hạn chế kinh doanh mà chặn một cú gõ
 * nhầm thành lượt giữ mười nghìn chỗ.
 *
 * Để ở một chỗ duy nhất vì ba nơi từng lệch nhau: câu chữ dưới ô nhập ghi
 * "tối đa 20 khách" trong khi ô nhập cho gõ tới 45 và máy chủ nhận 45. Câu
 * chữ mới đọc thẳng hằng số này, nên không tự lệch lại được nữa.
 */
export const WEB_BOOKING_MAX_PARTY_SIZE = 45;

export const CustomerBookingHoldRequestSchema = z
  .object({
    request_id: z.string().uuid(),
    anonymous_id: z.string().uuid(),
    product_id: z.string().uuid(),
    visit_date: z.iso.date(),
    party_size: z.number().int().min(1).max(WEB_BOOKING_MAX_PARTY_SIZE),
    // TC-03: hai nhóm tuổi, `party_size` vẫn là tổng.
    //
    // Để trống được, và đó là chủ ý: một tab mở từ trước lúc triển khai vẫn
    // đặt được, mọi khách tính là người lớn — đúng bằng hành vi cũ. Bắt buộc
    // sẽ đổi lỗi ấy thành một màn hình đỏ mà khách không hiểu vì sao.
    adults: z.number().int().min(1).max(WEB_BOOKING_MAX_PARTY_SIZE).optional(),
    children: z.number().int().min(0).max(WEB_BOOKING_MAX_PARTY_SIZE - 1).optional(),
    // TC-02: khách phải chọn đúng một khung giờ trước khi giữ chỗ — không còn
    // đường nào lặng lẽ rơi về "giữ mọi khung đang bật" từ mặt khách nữa.
    // Nhận cả dạng có độ lệch múi giờ, không riêng dạng kết thúc bằng "Z".
    //
    // Chính máy chủ phát ra khung giờ này: `booking-repository` đọc cột
    // `starts_at` của PostgreSQL rồi trả nguyên văn ra mặt khách, mà
    // PostgreSQL viết "2026-09-13T02:30:00+00:00". Màn hình gửi lại đúng
    // chuỗi ấy, và bản cũ của dòng này từ chối nó — nên **mọi lượt giữ chỗ
    // trên production đều trả 400 CUSTOMER_BOOKING_INPUT_INVALID**, không một
    // khách nào đặt được vé. Phát ra một dạng rồi chỉ nhận một dạng khác là
    // lỗi của máy chủ, không phải của người gửi.
    slot_starts_at: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((value) => (value.adults === undefined) === (value.children === undefined), {
    message: "Khai số người lớn thì phải khai luôn số trẻ em, và ngược lại.",
    path: ["children"],
  })
  .refine(
    (value) =>
      value.adults === undefined || value.adults + (value.children ?? 0) === value.party_size,
    {
      message: "Số người lớn cộng số trẻ em phải đúng bằng tổng số khách.",
      path: ["party_size"],
    },
  );

/**
 * TC-22 — khách chọn trả tiền ngay hay trả tại điểm.
 *
 * Bỏ trống `payment_mode` thì tính là `simulation`, đúng hành vi trước TC-22 —
 * mọi lời gọi cũ vẫn chạy y như cũ.
 *
 * **TC-25 gỡ một ràng buộc cũ, và đây là lý do.** Bản đầu CẤM gửi `contact`
 * kèm lối trả ngay, với lý lẽ đúng lúc ấy: *thu một dữ liệu cá nhân mà không
 * dùng tới là một khoản nợ, không phải một tính năng.*
 *
 * TC-23 lật tiền đề đó. Hệ thống chưa gửi được tin nhắn hay email nào, nên
 * `/tra-cuu-ve` là **đường lấy lại vé duy nhất** của khách, và nó đối chiếu
 * bằng mã đặt chỗ CỘNG liên hệ. Cấm lưu liên hệ ở lối trả ngay nghĩa là khách
 * đóng tab là mất vé, không còn đường nào lấy lại. Liên hệ giờ CÓ dùng tới.
 *
 * Nên luật mới: **trả tại điểm thì bắt buộc, trả ngay thì tuỳ khách.** Không
 * bắt buộc, không mặc định điền sẵn, và màn hình phải nói rõ nó dùng để làm gì.
 * Máy chủ băm và mã hoá trước khi lưu, không bao giờ lưu thô.
 */
export const CustomerBookingConfirmationRequestSchema = z
  .object({
    payment_request_id: z.string().uuid(),
    hold_id: z.string().uuid(),
    payment_mode: z.enum(["simulation", "pay-on-site"]).default("simulation"),
    contact: z.string().trim().min(6).max(160).optional(),
  })
  .strict()
  .refine(
    (value) => value.payment_mode !== "pay-on-site" || Boolean(value.contact),
    {
      message: "Chọn trả tiền tại điểm thì cần để lại số điện thoại hoặc email.",
      path: ["contact"],
    },
  );

// TC-02: tham số cho màn hình chọn giờ — chỉ đọc, không tạo hay khoá gì.
export const CustomerBookingSlotsQuerySchema = z
  .object({
    product_id: z.string().uuid(),
    visit_date: z.iso.date(),
  })
  .strict();

export type CustomerBookingSlot = {
  slotId: string;
  siteId: string;
  startsAt: string;
  endsAt: string;
  capacitySource: "estimate" | "customer" | "measured";
  thresholdVersion: number;
};

export type CustomerBookingTicket = {
  ticketId: string;
  ticketCode: string;
  siteId: string;
  validOn: string;
  entriesAllowed: number;
  // TC-03: vé nói rõ mình là vé nhóm nào. `group` là các vé phát trước TC-03,
  // hồi hệ thống còn gộp cả đoàn vào một tấm — giữ đúng tên cũ của chúng thay
  // vì đọc lại thành "người lớn".
  guestGroup: "adult" | "child" | "group";
  status: "issued" | "partially-used" | "used" | "void";
};

// TC-02 — một hàng thô từ `customer_list_product_slots`, đúng một cơ sở.
export type CustomerProductSlotRow = {
  siteId: string;
  // Giờ khởi hành của cả chuyến. Mọi chặng của cùng một chuyến chung một giá
  // trị; `startsAt` bên dưới mới là giờ riêng của từng chặng.
  departureStartsAt: string;
  localStartTime: string;
  startsAt: string;
  endsAt: string;
  effectiveCapacity: number;
  reserved: number;
  remaining: number;
  capacitySourceKind: "estimate" | "customer" | "measured";
  slotStatus: "open" | "paused";
};

// Một khung giờ như khách nhìn thấy — đã gộp mọi cơ sở của gói cùng giờ bắt
// đầu. Một gói nhiều chặng chỉ có MỘT khung giờ cho khách chọn (TC-03 mới xử
// lý lịch trình lệch giờ giữa các chặng); vì vậy số chỗ còn lại hiển thị phải
// là số nhỏ nhất trong các cơ sở, không phải tổng hay trung bình — thiếu chỗ ở
// bất kỳ cơ sở nào cũng làm cả lượt giữ chỗ thất bại.
export type CustomerProductTimeSlot = {
  startsAt: string;
  endsAt: string;
  siteIds: string[];
  remaining: number;
  capacitySourceKind: "estimate" | "customer" | "measured";
  bookable: boolean;
  blockedReason: "paused" | "full" | null;
};

const CAPACITY_SOURCE_WEAKNESS: Record<CustomerProductSlotRow["capacitySourceKind"], number> = {
  estimate: 0,
  customer: 1,
  measured: 2,
};

/**
 * Gộp các hàng khung giờ thô (mỗi hàng một cơ sở) theo đúng `startsAt`.
 *
 * Số chỗ còn lại của khung là số NHỎ NHẤT trong các cơ sở — đúng bằng điểm
 * nghẽn thật mà `customer_create_booking_hold` sẽ gặp khi giữ đồng thời tại
 * mọi cơ sở của gói. Nguồn số hiển thị là nguồn "yếu" nhất trong nhóm (ước
 * lượng đứng trước số liệu doanh nghiệp, đứng trước số đã đo) — không được để
 * một cơ sở có số đo thật che mất một cơ sở còn lại chỉ đang ước lượng.
 */
export function mergeProductSlotRows(
  rows: readonly CustomerProductSlotRow[],
): CustomerProductTimeSlot[] {
  const byStartsAt = new Map<string, CustomerProductSlotRow[]>();
  for (const row of rows) {
    const bucket = byStartsAt.get(row.departureStartsAt);
    if (bucket) {
      bucket.push(row);
    } else {
      byStartsAt.set(row.departureStartsAt, [row]);
    }
  }
  return [...byStartsAt.entries()]
    .map(([startsAt, group]) => {
      const remaining = Math.min(...group.map((row) => row.remaining));
      const paused = group.some((row) => row.slotStatus === "paused");
      const endsAt = group.reduce(
        (latest, row) => (row.endsAt > latest ? row.endsAt : latest),
        group[0].endsAt,
      );
      const capacitySourceKind = group.reduce<CustomerProductSlotRow["capacitySourceKind"]>(
        (weakest, row) =>
          CAPACITY_SOURCE_WEAKNESS[row.capacitySourceKind] < CAPACITY_SOURCE_WEAKNESS[weakest]
            ? row.capacitySourceKind
            : weakest,
        group[0].capacitySourceKind,
      );
      return {
        startsAt,
        endsAt,
        siteIds: [...new Set(group.map((row) => row.siteId))].sort(),
        remaining,
        capacitySourceKind,
        bookable: !paused && remaining > 0,
        blockedReason: paused ? ("paused" as const) : remaining <= 0 ? ("full" as const) : null,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * TC-23 — lấy lại vé bằng mã đặt chỗ cộng liên hệ đã dùng khi đặt.
 *
 * Hai ô, không một ô. Chỉ mã đặt chỗ thì chưa đủ: mã hiện trên màn hình, chụp
 * lại được, nhìn qua vai cũng đọc được. Ai đoán trúng một mã mà mở được vé
 * người khác thì cả luồng vé mất nghĩa.
 */
export const CustomerTicketLookupRequestSchema = z
  .object({
    order_code: z.string().trim().min(4).max(40),
    contact: z.string().trim().min(6).max(160),
  })
  .strict();

/**
 * Đưa mã khách gõ về đúng khuôn máy chủ lưu: `NBJ-` cộng 12 ký tự.
 *
 * Khách chép mã từ màn hình, từ ảnh chụp, từ tin nhắn gửi cho người nhà — nên
 * dấu cách, chữ thường và cái gạch nối bị rơi mất đều là chuyện thường. Nhận
 * hết những dạng đó rồi tự nắn lại, thay vì bắt khách gõ đúng từng ký tự.
 *
 * Trả `null` khi không nắn nổi. Chỗ gọi phải hiểu đây là "gõ chưa đúng khuôn",
 * KHÔNG phải "không có mã này" — hai câu ấy nói hai chuyện khác hẳn nhau.
 */
export function normalizeCustomerOrderCode(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/[\s.–—-]/g, "");
  const body = compact.startsWith("NBJ") ? compact.slice(3) : compact;
  return /^[A-Z0-9]{12}$/.test(body) ? `NBJ-${body}` : null;
}

export type CustomerTicketLookupTicket = {
  ticketId: string;
  ticketCode: string;
  siteId: string;
  validOn: string;
  entriesAllowed: number;
  entriesUsed: number;
  guestGroup: "adult" | "child" | "group";
  status: "issued" | "partially-used" | "used" | "void";
};

export type CustomerTicketLookupResult =
  | { found: false; throttled: boolean }
  | {
      found: true;
      throttled: false;
      orderCode: string;
      productId: string;
      visitDate: string;
      partySize: number;
      adults: number | null;
      children: number | null;
      totalVnd: number;
      currency: "VND";
      paymentMode: "simulation" | "pay-on-site" | "qr-transfer" | null;
      paymentStatus: "succeeded" | "pending" | null;
      amountDueVnd: number;
      tickets: CustomerTicketLookupTicket[];
    };

/**
 * Máy đặt chỗ xin mở mã QR thanh toán cho lượt giữ đang có.
 *
 * Liên hệ BẮT BUỘC ở lối này: luật "ba lần giữ rồi bỏ trong bảy ngày thì mời
 * tới quầy" đếm theo số điện thoại, không có số thì không đếm được. Số tiền
 * chỉ để trang quét hiện cho khách xem; tiền thật do cơ sở dữ liệu tính.
 */
export const CustomerQrPaymentRequestSchema = z
  .object({
    hold_id: z.string().uuid(),
    payment_request_id: z.string().uuid(),
    contact: z.string().trim().min(6).max(160),
    amount_vnd: z.number().int().min(0).max(1_000_000_000),
    product_id: z.string().min(1).max(80),
  })
  .strict();

/** Cách trả nói bằng lời người vận hành hiểu, dùng chung cho mọi màn hình ERP. */
export function nhanCachTra(
  mode: "simulation" | "pay-on-site" | "qr-transfer" | null,
  status: string | null,
): string {
  if (mode === "qr-transfer" && status === "succeeded") return "Đã thanh toán bằng QR";
  if (mode === "pay-on-site") {
    if (status === "succeeded") return "Đã thu tiền mặt tại điểm";
    if (status === "cancelled") return "Đã huỷ vì khách không đến";
    return "Chờ thu tại điểm";
  }
  if (mode === "simulation" && status === "succeeded") return "Nhận vé trước, chưa thu tiền (bản thử cũ)";
  return "Chưa thanh toán";
}
