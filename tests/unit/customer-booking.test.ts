import { describe, expect, it } from "vitest";
import {
  CustomerBookingConfirmationRequestSchema,
  CustomerBookingHoldRequestSchema,
  CustomerBookingSlotsQuerySchema,
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
