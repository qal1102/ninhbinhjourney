import { describe, expect, it } from "vitest";
import { generateItinerary, parseJourneyIntent, confirmJourneyIntent } from "@/domain/journey";
import { DESTINATIONS } from "@/content/destinations";

/**
 * Soát 07/10/2026 trên production: sáu câu khách hay gõ vào `/plan` thì cả sáu
 * bị hiểu sai, mà trang vẫn ghi "Đúng kiểu đi bạn muốn". Bài này giữ đúng sáu
 * câu ấy cùng vài cách nói gần nó.
 *
 * Hôm nay ghim là thứ Tư 07/10/2026 (giờ Việt Nam).
 */
const HOM_NAY = new Date("2026-10-07T05:00:00Z");
const parse = (text: string, locale: "vi" | "en" = "vi") =>
  parseJourneyIntent({ text, locale, today: HOM_NAY });
const id = (slug: string) => DESTINATIONS.find((d) => d.slug === slug)!.id;

describe("sáu câu đã hỏng lúc soát", () => {
  it("vợ chồng với con 5 tuổi, nửa ngày buổi chiều, không leo núi, thích đi thuyền", () => {
    const d = parse("Mình đi 2 vợ chồng với con 5 tuổi, có nửa ngày buổi chiều, không leo núi được, thích đi thuyền");
    expect(d.party).toEqual({ adults: 2, children: 1, seniors: 0 });
    expect(d.durationMinutes).toBe(300);
    expect(d.batDauPhut).toBe(13 * 60);
    expect(d.walkingTolerance).toBe("low");
    expect(d.interests).toContain("nature");
  });

  it("gia đình 4 người có 2 bé, muốn đi Tràng An và Bái Đính", () => {
    const d = parse("gia đình 4 người có 2 bé, đi 1 ngày, muốn đi Tràng An và Bái Đính");
    expect(d.party).toEqual({ adults: 2, children: 2, seniors: 0 });
    expect(d.startSiteId).toBe(id("trang-an"));
  });

  it("bố mẹ già, chân yếu, đi chậm, sáng thứ 7 này", () => {
    const d = parse("đi với bố mẹ già, chân yếu, đi chậm thôi, sáng thứ 7 này");
    expect(d.party).toEqual({ adults: 1, children: 0, seniors: 2 });
    expect(d.walkingTolerance).toBe("low");
    expect(d.pace).toBe("relaxed");
    expect(d.visitDate).toBe("2026-10-10");
  });

  it("3 đứa bạn thích leo núi chụp ảnh hoàng hôn Hang Múa", () => {
    const d = parse("3 đứa bạn thích leo núi chụp ảnh hoàng hôn Hang Múa, đi cả ngày");
    expect(d.party?.adults).toBe(3);
    expect(d.walkingTolerance).toBe("high");
    expect(d.interests).toContain("photography");
    expect(d.startSiteId).toBe(id("hang-mua"));
    expect(d.durationMinutes).toBe(600);
  });

  it("gõ không dấu: tam coc ngay mai, 2 nguoi", () => {
    const d = parse("toi muon di tam coc ngay mai, 2 nguoi");
    expect(d.party?.adults).toBe(2);
    expect(d.visitDate).toBe("2026-10-08");
    expect(d.startSiteId).toBe(id("tam-coc-bich-dong"));
  });

  it("tiếng Anh: one day with my wife, boats and caves", () => {
    const d = parse("I have one day with my wife, we like boats and caves", "en");
    expect(d.party?.adults).toBe(2);
    expect(d.partyContext).toEqual(["couple"]);
    expect(d.interests).toContain("nature");
  });
});

describe("không đọc nhầm", () => {
  it("'còn' không phải con, 'đến' không phải đền, 'hàng' không phải hang", () => {
    const d = parse("Tôi còn một ngày, đến Ninh Bình, không thích xếp hàng");
    expect(d.party?.children ?? 0).toBe(0);
    expect(d.interests ?? []).not.toContain("spirituality");
    expect(d.interests ?? []).not.toContain("nature");
  });

  it("'tôi' bỏ dấu không thành buổi tối", () => {
    expect(parse("toi co 1 ngay").batDauPhut).toBeUndefined();
  });

  it("hai người cao tuổi không bị đếm thêm người lớn", () => {
    expect(parse("2 người cao tuổi, đi 1 ngày").party).toEqual({ adults: 0, children: 0, seniors: 2 });
  });

  it("phố cổ Hoa Lư là phố cổ, không phải cố đô", () => {
    expect(parse("tối muốn dạo phố cổ Hoa Lư").startSiteId).toBe(id("hoa-lu-old-town"));
  });

  it("tôi với 2 người bạn là ba người", () => {
    expect(parse("tôi với 2 người bạn đi 1 ngày").party?.adults).toBe(3);
  });
});

describe("ngày nói miệng", () => {
  it.each([
    ["hôm nay", "2026-10-07"],
    ["mai đi", "2026-10-08"],
    ["ngày kia", "2026-10-09"],
    ["chủ nhật", "2026-10-11"],
    ["thứ 2 tuần sau", "2026-10-12"],
    ["thứ 4", "2026-10-07"],
    ["cuối tuần này", "2026-10-10"],
    ["next friday", "2026-10-16"],
  ])("%s", (cau, ngay) => {
    expect(parse(`đi ${cau}`).visitDate).toBe(ngay);
  });

  it("ngày viết số vẫn thắng cách nói", () => {
    expect(parse("đi ngày 20/10, tức thứ 3 tuần sau").visitDate).toBe("2026-10-20");
  });
});

describe("lịch bắt đầu theo buổi", () => {
  it("buổi chiều thì không chặng nào trước 13 giờ", () => {
    const d = parse("2 người đi buổi chiều");
    const intent = confirmJourneyIntent({
      draft: d,
      demoRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      durationMinutes: d.durationMinutes ?? 300,
      party: d.party ?? { adults: 2, children: 0, seniors: 0 },
      partyContext: [],
      pace: "balanced",
      walkingTolerance: "moderate",
      visitDate: "2026-10-10",
    });
    const lich = generateItinerary(intent, { visitDate: "2026-10-10", batDauPhut: d.batDauPhut });
    expect(lich.items.length).toBeGreaterThan(0);
    for (const item of lich.items) expect(item.startAt.slice(11, 16) >= "13:00").toBe(true);
    expect(lich.validation.valid).toBe(true);
  });
});
