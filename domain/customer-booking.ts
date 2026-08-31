import { z } from "zod";

export const CustomerBookingHoldRequestSchema = z
  .object({
    request_id: z.string().uuid(),
    anonymous_id: z.string().uuid(),
    product_id: z.string().uuid(),
    visit_date: z.iso.date(),
    // TC-15: tran 45 — mot xe khach lon o Viet Nam la 45 cho. Van phai co
    // tran, vi no chan mot cu go nham thanh mot luot giu 10.000 cho.
    party_size: z.number().int().min(1).max(45),
    // TC-03: hai nhóm tuổi, `party_size` vẫn là tổng.
    //
    // Để trống được, và đó là chủ ý: một tab mở từ trước lúc triển khai vẫn
    // đặt được, mọi khách tính là người lớn — đúng bằng hành vi cũ. Bắt buộc
    // sẽ đổi lỗi ấy thành một màn hình đỏ mà khách không hiểu vì sao.
    adults: z.number().int().min(1).max(45).optional(),
    children: z.number().int().min(0).max(44).optional(),
    // TC-02: khách phải chọn đúng một khung giờ trước khi giữ chỗ — không còn
    // đường nào lặng lẽ rơi về "giữ mọi khung đang bật" từ mặt khách nữa.
    slot_starts_at: z.iso.datetime(),
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

export const CustomerBookingConfirmationRequestSchema = z
  .object({
    payment_request_id: z.string().uuid(),
    hold_id: z.string().uuid(),
  })
  .strict();

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
