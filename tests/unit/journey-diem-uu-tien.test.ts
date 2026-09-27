import { describe, expect, it } from "vitest";
import { confirmJourneyIntent, generateItinerary, parseJourneyIntent } from "@/domain/journey";
import { DESTINATIONS } from "@/content/destinations";

function y(walkingTolerance: "low" | "moderate" | "high") {
  const draft = parseJourneyIntent({ text: "Tôi có một ngày, đi cùng gia đình.", locale: "vi" });
  return confirmJourneyIntent({
    draft,
    demoRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    durationMinutes: 600,
    party: { adults: 2, children: 0, seniors: 0 },
    partyContext: [],
    pace: "relaxed",
    walkingTolerance,
    visitDate: "2026-10-10",
  });
}

const id = (slug: string) => DESTINATIONS.find((d) => d.slug === slug)!.id;

// Nút "Thêm vào hành trình" ở trang điểm đến và Khám phá gửi điểm khách chọn.
describe("điểm khách chọn trước khi lập lịch", () => {
  it("đứng đầu lịch khi vừa sức đi bộ, dù bình thường nó không có trong hàng ưu tiên", () => {
    const binhThuong = generateItinerary(y("low"), { visitDate: "2026-10-10" });
    expect(binhThuong.items[0]?.siteId).not.toBe(id("van-long"));

    const coChon = generateItinerary(y("low"), { visitDate: "2026-10-10", uuTienSiteId: id("van-long") });
    expect(coChon.items[0]?.siteId).toBe(id("van-long"));
    expect(coChon.validation.valid).toBe(true);
  });

  it("không lén xếp nơi vượt mức đi bộ khách nêu", () => {
    const lich = generateItinerary(y("low"), { visitDate: "2026-10-10", uuTienSiteId: id("hang-mua") });
    expect(lich.items.map((item) => item.siteId)).not.toContain(id("hang-mua"));
    expect(lich.items.length).toBeGreaterThan(0);

    const diNhieu = generateItinerary(y("high"), { visitDate: "2026-10-10", uuTienSiteId: id("hang-mua") });
    expect(diNhieu.items[0]?.siteId).toBe(id("hang-mua"));
  });

  it("mã lạ thì bỏ qua, lịch dựng như thường", () => {
    const lich = generateItinerary(y("low"), { visitDate: "2026-10-10", uuTienSiteId: "00000000-0000-4000-8000-00000000ffff" });
    expect(lich.items).toEqual(generateItinerary(y("low"), { visitDate: "2026-10-10" }).items.map((item, i) => ({ ...item, id: lich.items[i].id })));
  });
});
