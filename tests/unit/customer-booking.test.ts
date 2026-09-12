import { describe, expect, it } from "vitest";
import {
  CustomerBookingConfirmationRequestSchema,
  CustomerBookingHoldRequestSchema,
  CustomerBookingSlotsQuerySchema,
  WEB_BOOKING_MAX_PARTY_SIZE,
} from "@/domain/customer-booking";

describe("CUS-06 customer booking request contract", () => {
  it("accepts an anonymous-first hold without contact or payment data", () => {
    const result = CustomerBookingHoldRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 3,
      slot_starts_at: "2026-08-21T09:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects raw contact, card fields and oversized parties", () => {
    const base = {
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 21,
      slot_starts_at: "2026-08-21T09:00:00.000Z",
      email: "guest@example.com",
      card_number: "4111111111111111",
    };
    expect(CustomerBookingHoldRequestSchema.safeParse(base).success).toBe(false);
  });

  it("TC-02: rejects a hold with no chosen time slot", () => {
    const result = CustomerBookingHoldRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 3,
    });
    expect(result.success).toBe(false);
  });

  it("TC-02: validates the read-only slots query", () => {
    expect(CustomerBookingSlotsQuerySchema.safeParse({
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
    }).success).toBe(true);
    expect(CustomerBookingSlotsQuerySchema.safeParse({
      product_id: "not-a-uuid",
      visit_date: "2026-08-21",
    }).success).toBe(false);
    expect(CustomerBookingSlotsQuerySchema.safeParse({
      product_id: "40000000-0000-4000-8000-000000000001",
    }).success).toBe(false);
  });

  it("TC-03: bỏ trống cả adults lẫn children vẫn hợp lệ — đường tương thích ngược", () => {
    // Một tab đặt chỗ mở từ trước lúc TC-03 triển khai không hề biết hai
    // trường này tồn tại. Bắt buộc khai chúng sẽ biến mọi lượt đặt cũ đang
    // dở dang thành một màn hình lỗi mà khách không hiểu vì sao.
    const result = CustomerBookingHoldRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 3,
      slot_starts_at: "2026-08-21T09:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("TC-03: khai adults mà thiếu children thì bị từ chối, và ngược lại", () => {
    // Chấp nhận một bên mà thiếu bên kia là để hệ thống tự suy đoán số còn
    // lại — đúng thứ đã gây ra vé sai loại một lần trước đây. Phải bắt khách
    // khai đủ cả hai, hoặc không khai gì.
    const thieuChildren = CustomerBookingHoldRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 3,
      slot_starts_at: "2026-08-21T09:00:00.000Z",
      adults: 3,
    });
    expect(thieuChildren.success).toBe(false);

    const thieuAdults = CustomerBookingHoldRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 3,
      slot_starts_at: "2026-08-21T09:00:00.000Z",
      children: 1,
    });
    expect(thieuAdults.success).toBe(false);
  });

  it("TC-03: adults + children khác party_size thì bị từ chối", () => {
    // Số trẻ em quyết định áo phao, chỗ ngồi và người đi kèm ở bến thuyền —
    // một tổng sai lệch ở đây đi thẳng ra tới cổng mà không ai phát hiện.
    const result = CustomerBookingHoldRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 3,
      slot_starts_at: "2026-08-21T09:00:00.000Z",
      adults: 2,
      children: 2,
    });
    expect(result.success).toBe(false);
  });

  it("TC-03: adults = 0 bị từ chối — trẻ em không đi một mình", () => {
    const result = CustomerBookingHoldRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 2,
      slot_starts_at: "2026-08-21T09:00:00.000Z",
      adults: 0,
      children: 2,
    });
    expect(result.success).toBe(false);
  });

  it("TC-03: đúng tổng hai nhóm tuổi thì qua", () => {
    const result = CustomerBookingHoldRequestSchema.safeParse({
      request_id: "10000000-0000-4000-8000-000000000001",
      anonymous_id: "20000000-0000-4000-8000-000000000001",
      product_id: "40000000-0000-4000-8000-000000000001",
      visit_date: "2026-08-21",
      party_size: 3,
      slot_starts_at: "2026-08-21T09:00:00.000Z",
      adults: 2,
      children: 1,
    });
    expect(result.success).toBe(true);
  });

  it("confirms only by payment request and owned hold IDs", () => {
    expect(CustomerBookingConfirmationRequestSchema.safeParse({
      payment_request_id: "30000000-0000-4000-8000-000000000001",
      hold_id: "40000000-0000-4000-8000-000000000001",
    }).success).toBe(true);
    expect(CustomerBookingConfirmationRequestSchema.safeParse({
      payment_request_id: "30000000-0000-4000-8000-000000000001",
      hold_id: "40000000-0000-4000-8000-000000000001",
      payment_token: "real-token-forbidden",
    }).success).toBe(false);
  });
});

describe("khung giờ gửi lên phải nhận đúng dạng chính máy chủ phát ra", () => {
  /*
   * Ngày 12/09/2026 không một khách nào đặt được vé trên production.
   *
   * `booking-repository` đọc cột `starts_at` của PostgreSQL rồi trả nguyên
   * văn ra mặt khách, mà PostgreSQL viết độ lệch múi giờ: "+00:00". Màn hình
   * gửi lại đúng chuỗi vừa nhận, còn lược đồ này chỉ nhận dạng kết thúc bằng
   * "Z" — nên mọi lượt giữ chỗ đều dừng ở 400 CUSTOMER_BOOKING_INPUT_INVALID.
   *
   * Cả tám bài phía trên đều viết sẵn dạng "Z", nên không bài nào chạm tới
   * dạng mà sản phẩm thật gửi đi. Bài này đóng đúng khe đó.
   */
  const nen = {
    request_id: "10000000-0000-4000-8000-000000000001",
    anonymous_id: "20000000-0000-4000-8000-000000000001",
    product_id: "40000000-0000-4000-8000-000000000001",
    visit_date: "2026-09-13",
    party_size: 2,
  };

  it("nhận dạng có độ lệch múi giờ, đúng dạng PostgreSQL trả về", () => {
    const ket_qua = CustomerBookingHoldRequestSchema.safeParse({
      ...nen,
      slot_starts_at: "2026-09-13T02:30:00+00:00",
    });
    expect(ket_qua.success).toBe(true);
  });

  it("nhận cả độ lệch giờ Việt Nam, vì cùng một mốc thời gian", () => {
    const ket_qua = CustomerBookingHoldRequestSchema.safeParse({
      ...nen,
      slot_starts_at: "2026-09-13T09:30:00+07:00",
    });
    expect(ket_qua.success).toBe(true);
  });

  it("vẫn nhận dạng kết thúc bằng Z", () => {
    const ket_qua = CustomerBookingHoldRequestSchema.safeParse({
      ...nen,
      slot_starts_at: "2026-09-13T02:30:00.000Z",
    });
    expect(ket_qua.success).toBe(true);
  });

  it("vẫn từ chối chuỗi không phải mốc thời gian", () => {
    for (const xau of ["2026-09-13", "hôm nay", "13/09/2026 09:30", ""]) {
      expect(
        CustomerBookingHoldRequestSchema.safeParse({ ...nen, slot_starts_at: xau }).success,
        `"${xau}" đáng lẽ phải bị từ chối`,
      ).toBe(false);
    }
  });
});

describe("trần số khách của web chỉ có một nguồn", () => {
  const nen = {
    request_id: "10000000-0000-4000-8000-000000000001",
    anonymous_id: "20000000-0000-4000-8000-000000000001",
    product_id: "40000000-0000-4000-8000-000000000001",
    visit_date: "2026-09-13",
    slot_starts_at: "2026-09-13T02:30:00+00:00",
  };

  it("giữ nguyên trần 45 theo quyết định TC-15, đủ một xe lớn", () => {
    // Trần này là quyết định kinh doanh, không phải con số tuỳ ý: đoàn thật đi
    // xe 32 chỗ, và trần cũ 20 chặn đúng loại khách ấy. Sáu ràng buộc dưới cơ
    // sở dữ liệu cũng đã nới lên 45 cho khớp, nên hạ ở đây là làm lệch hai tầng.
    expect(WEB_BOOKING_MAX_PARTY_SIZE).toBe(45);
  });

  it("nhận đúng bằng trần, từ chối hơn trần một người", () => {
    expect(
      CustomerBookingHoldRequestSchema.safeParse({
        ...nen,
        party_size: WEB_BOOKING_MAX_PARTY_SIZE,
      }).success,
    ).toBe(true);
    expect(
      CustomerBookingHoldRequestSchema.safeParse({
        ...nen,
        party_size: WEB_BOOKING_MAX_PARTY_SIZE + 1,
      }).success,
    ).toBe(false);
  });
});
