import { describe, expect, it } from "vitest";
import { mergeProductSlotRows, type CustomerProductSlotRow } from "@/domain/customer-booking";

function row(overrides: Partial<CustomerProductSlotRow>): CustomerProductSlotRow {
  return {
    siteId: "10000000-0000-4000-8000-000000000001",
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
