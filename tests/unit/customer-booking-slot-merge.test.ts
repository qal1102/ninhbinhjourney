import { describe, expect, it } from "vitest";
import { mergeProductSlotRows, type CustomerProductSlotRow } from "@/domain/customer-booking";

function row(overrides: Partial<CustomerProductSlotRow>): CustomerProductSlotRow {
  const base: CustomerProductSlotRow = {
    siteId: "10000000-0000-4000-8000-000000000001",
    departureStartsAt: "2026-08-22T02:00:00.000Z",
    localStartTime: "09:00:00",
    startsAt: "2026-08-22T02:00:00.000Z",
    endsAt: "2026-08-22T04:00:00.000Z",
    effectiveCapacity: 40,
    reserved: 0,
    remaining: 40,
    capacitySourceKind: "estimate",
    slotStatus: "open",
    ...overrides,
  };
  // Chuyến một chặng thì giờ khởi hành chính là giờ của chặng đó. Cho mặc
  // định bám theo `startsAt` để các bài chỉ đổi `startsAt` vẫn nói đúng ý
  // "đây là hai chuyến khác nhau" — muốn dựng chuyến nhiều chặng thì truyền
  // `departureStartsAt` tường minh.
  return { ...base, departureStartsAt: overrides.departureStartsAt ?? base.startsAt };
}

describe("TC-02 mergeProductSlotRows", () => {
  it("gộp nhiều cơ sở cùng starts_at thành một khung giờ, lấy số nhỏ nhất làm số chỗ còn lại", () => {
    const merged = mergeProductSlotRows([
      row({ siteId: "site-a", remaining: 30, capacitySourceKind: "measured" }),
      row({ siteId: "site-b", remaining: 5, capacitySourceKind: "estimate" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      remaining: 5,
      capacitySourceKind: "estimate",
      bookable: true,
      blockedReason: null,
      siteIds: ["site-a", "site-b"],
    });
  });

  it("giữ hai khung giờ khác nhau tách biệt, không ăn vào nhau", () => {
    const merged = mergeProductSlotRows([
      row({ startsAt: "2026-08-22T02:00:00.000Z", remaining: 10 }),
      row({ startsAt: "2026-08-22T07:00:00.000Z", remaining: 20 }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].startsAt).toBe("2026-08-22T02:00:00.000Z");
    expect(merged[1].startsAt).toBe("2026-08-22T07:00:00.000Z");
  });

  it("một cơ sở hết chỗ thì cả khung không đặt được, dù cơ sở kia còn nhiều", () => {
    const merged = mergeProductSlotRows([
      row({ siteId: "site-a", remaining: 25 }),
      row({ siteId: "site-b", remaining: 0 }),
    ]);
    expect(merged[0]).toMatchObject({ remaining: 0, bookable: false, blockedReason: "full" });
  });

  it("một cơ sở tạm dừng thì cả khung không đặt được, kể cả khi còn chỗ", () => {
    const merged = mergeProductSlotRows([
      row({ siteId: "site-a", remaining: 25, slotStatus: "open" }),
      row({ siteId: "site-b", remaining: 25, slotStatus: "paused" }),
    ]);
    expect(merged[0]).toMatchObject({ remaining: 25, bookable: false, blockedReason: "paused" });
  });

  it("sắp xếp khung giờ theo đúng thứ tự thời gian dù dữ liệu vào không theo thứ tự", () => {
    const merged = mergeProductSlotRows([
      row({ startsAt: "2026-08-22T10:00:00.000Z" }),
      row({ startsAt: "2026-08-22T02:00:00.000Z" }),
      row({ startsAt: "2026-08-22T06:00:00.000Z" }),
    ]);
    expect(merged.map((slot) => slot.startsAt)).toEqual([
      "2026-08-22T02:00:00.000Z",
      "2026-08-22T06:00:00.000Z",
      "2026-08-22T10:00:00.000Z",
    ]);
  });

  it("mảng rỗng trả về mảng rỗng, không bịa một khung nào", () => {
    expect(mergeProductSlotRows([])).toEqual([]);
  });
});

describe("TC-02 vá gấp: chuyến nhiều chặng không bị cắt đôi", () => {
  /**
   * Lỗi thật, đo trên production ngày 29/08 trước khi vá.
   *
   * Gói "Gia đình khám phá" đi Tràng An 08:00 rồi Bái Đính 13:30 trong cùng
   * một ngày. Gộp theo giờ của **từng chặng** thì khách thấy hai "khung giờ",
   * chọn một cái và chỉ được giữ chỗ một nơi — trả tiền một chuyến hai điểm
   * mà chỉ có chỗ ở một điểm. Gộp theo **giờ khởi hành** thì đúng một lựa chọn.
   */
  function chang(overrides: Partial<CustomerProductSlotRow>): CustomerProductSlotRow {
    return {
      siteId: "trang-an",
      departureStartsAt: "2026-09-28T01:00:00.000Z",
      localStartTime: "08:00:00",
      startsAt: "2026-09-28T01:00:00.000Z",
      endsAt: "2026-09-28T02:00:00.000Z",
      effectiveCapacity: 800,
      reserved: 0,
      remaining: 800,
      capacitySourceKind: "estimate",
      slotStatus: "open",
      ...overrides,
    };
  }

  it("hai chặng cùng một chuyến chỉ hiện ra MỘT lựa chọn", () => {
    const merged = mergeProductSlotRows([
      chang({}),
      chang({
        siteId: "bai-dinh",
        localStartTime: "13:30:00",
        startsAt: "2026-09-28T06:30:00.000Z",
        endsAt: "2026-09-28T07:30:00.000Z",
        remaining: 1440,
      }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].siteIds).toEqual(["bai-dinh", "trang-an"]);
    // Số chỗ là điểm nghẽn thật của cả chuyến, không phải của chặng đầu.
    expect(merged[0].remaining).toBe(800);
    // Giờ hiện cho khách là giờ khởi hành; giờ kết thúc là lúc chặng cuối xong.
    expect(merged[0].startsAt).toBe("2026-09-28T01:00:00.000Z");
    expect(merged[0].endsAt).toBe("2026-09-28T07:30:00.000Z");
  });

  it("chặng sau hết chỗ thì cả chuyến không đặt được", () => {
    const merged = mergeProductSlotRows([
      chang({}),
      chang({ siteId: "bai-dinh", localStartTime: "13:30:00", remaining: 0 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].bookable).toBe(false);
    expect(merged[0].blockedReason).toBe("full");
  });

  it("hai chuyến khác giờ khởi hành vẫn là hai lựa chọn riêng", () => {
    const merged = mergeProductSlotRows([
      chang({}),
      chang({
        departureStartsAt: "2026-09-28T03:00:00.000Z",
        localStartTime: "10:00:00",
        startsAt: "2026-09-28T03:00:00.000Z",
      }),
    ]);
    expect(merged).toHaveLength(2);
  });
});
