import { describe, expect, it } from "vitest";
import {
  confirmJourneyIntent,
  generateItinerary,
  parseJourneyIntent,
} from "@/domain/journey";

/**
 * Những cách nói mà trình lập kế hoạch từng không hiểu.
 *
 * Chủ dự án dùng thử `/plan` rồi nói ô kể mong muốn "chả có tác dụng gì".
 * Một phần lý do nằm ở đây: người Việt nói "hai ngày", "nửa ngày", "cặp đôi",
 * "đi một mình", còn máy chỉ đọc được chữ số và đúng vài khuôn câu mẫu.
 *
 * Bài kiểm này giữ hai thứ cùng lúc: máy hiểu thêm được chữ, **và** máy không
 * hứa quá điều nó làm được — mục cuối cùng khoá đúng chỗ ấy.
 */
function parse(text: string) {
  return parseJourneyIntent({ text, locale: "vi" });
}

describe("đọc số ngày trong câu khách viết", () => {
  it("nửa ngày là năm tiếng, không phải trọn ngày", () => {
    const draft = parse("Tôi chỉ có nửa ngày ở Ninh Bình thôi.");
    expect(draft.durationMinutes).toBe(300);
    expect(draft.tripDays).toBe(1);
  });

  it("một ngày viết bằng chữ hay bằng số đều ra một ngày", () => {
    expect(parse("Tôi có một ngày.").durationMinutes).toBe(600);
    expect(parse("Tôi có 1 ngày.").durationMinutes).toBe(600);
    expect(parse("Tôi có một ngày.").tripDays).toBe(1);
  });

  it("hai ngày, ba ngày viết bằng chữ đều đọc được", () => {
    expect(parse("Nhà tôi đi hai ngày.").tripDays).toBe(2);
    expect(parse("Nhà tôi đi ba ngày.").tripDays).toBe(3);
    expect(parse("Nhà tôi đi 2 ngày 1 đêm.").tripDays).toBe(2);
  });

  it("cuối tuần hiểu là hai ngày, nhưng để độ chắc thấp vì đó là suy đoán", () => {
    const draft = parse("Nhà tôi định đi cuối tuần này.");
    expect(draft.tripDays).toBe(2);
    expect(draft.fieldConfidence.durationMinutes).toBeLessThan(0.8);
  });

  it("số ngày nhiều KHÔNG được nhân thời lượng lên", () => {
    // Chỗ này mới là điều quan trọng nhất của cả tệp. `generateItinerary`
    // dựng đúng một ngày; để `durationMinutes` thành 1.200 là dựng ra một
    // "ngày" hai mươi tiếng mà khách không bao giờ đi nổi.
    const draft = parse("Nhà tôi đi ba ngày.");
    expect(draft.durationMinutes).toBe(600);
  });

  it("ngày trong ngày tháng không bị đọc nhầm thành số ngày đi", () => {
    // "ngày 12" là con số ĐỨNG SAU chữ ngày, không phải số ngày đi.
    const draft = parse("Tôi đi ngày 12 tháng 9, khoảng 6 giờ thôi.");
    expect(draft.tripDays).toBeUndefined();
    expect(draft.durationMinutes).toBe(360);
  });

  it("không nói gì về thời gian thì không tự đặt ra", () => {
    const draft = parse("Tôi muốn đi thong thả, ít đi bộ.");
    expect(draft.durationMinutes).toBeUndefined();
    expect(draft.tripDays).toBeUndefined();
  });
});

describe("đọc người đi cùng", () => {
  it("cặp đôi là hai người lớn", () => {
    for (const cau of [
      "Hai vợ chồng tôi muốn đi thong thả.",
      "Tụi mình là cặp đôi, thích chụp ảnh.",
      "Tôi đi với người yêu.",
    ]) {
      const draft = parse(cau);
      expect(draft.party).toEqual({ adults: 2, children: 0, seniors: 0 });
      expect(draft.partyContext).toEqual(["couple"]);
    }
  });

  it("đi một mình là một người lớn", () => {
    const draft = parse("Tôi đi một mình, muốn leo nhiều.");
    expect(draft.party).toEqual({ adults: 1, children: 0, seniors: 0 });
    expect(draft.partyContext).toEqual(["solo"]);
  });

  it("số khách nói thẳng vẫn được ưu tiên hơn cách nói", () => {
    const draft = parse("Hai vợ chồng tôi đi cùng 4 người lớn nữa.");
    expect(draft.party?.adults).toBe(4);
  });

  it("số người viết bằng chữ đọc được", () => {
    expect(parse("Đoàn tôi có ba người lớn.").party?.adults).toBe(3);
    expect(parse("Nhà tôi có hai người lớn và 2 trẻ.").party).toEqual({
      adults: 2,
      children: 2,
      seniors: 0,
    });
  });

  it("bố mẹ vẫn giữ nguyên cách hiểu cũ, không bị hai nhánh mới cướp mất", () => {
    const draft = parse("Tôi đi cùng bố mẹ, muốn nhẹ nhàng.");
    expect(draft.partyContext).toEqual(["travelling-with-parents"]);
    expect(draft.party?.adults).toBe(3);
  });

  it("Tam Cốc không bị đọc thành số tám", () => {
    // "tám" nằm sẵn trong "Tam Cốc"; số chỉ được tính khi dính liền
    // chữ "ngày" hoặc "người".
    const draft = parse("Tôi muốn đi Tam Cốc và Hang Múa.");
    expect(draft.party).toBeUndefined();
    expect(draft.tripDays).toBeUndefined();
  });
});

describe("số ngày không lọt vào bản đã chốt", () => {
  it("confirmJourneyIntent không mang tripDays sang", () => {
    const draft = parse("Nhà tôi đi hai ngày, ít đi bộ.");
    const intent = confirmJourneyIntent({
      draft,
      demoRunId: "00000000-0000-4000-8000-000000000001",
      id: "00000000-0000-4000-8000-000000000002",
      durationMinutes: draft.durationMinutes ?? 600,
      party: { adults: 2, children: 0, seniors: 0 },
      partyContext: draft.partyContext ?? [],
      pace: "relaxed",
      walkingTolerance: "low",
      visitDate: "2026-09-12",
    });
    expect("tripDays" in intent).toBe(false);
    expect(intent.durationMinutes).toBe(600);
  });

  it("lịch trình dựng ra vẫn nằm gọn trong một ngày", () => {
    const draft = parse("Nhà tôi đi ba ngày, ít đi bộ.");
    let seq = 0;
    const intent = confirmJourneyIntent({
      draft,
      demoRunId: "00000000-0000-4000-8000-000000000001",
      id: "00000000-0000-4000-8000-000000000002",
      durationMinutes: draft.durationMinutes ?? 600,
      party: { adults: 2, children: 0, seniors: 0 },
      partyContext: [],
      pace: "relaxed",
      walkingTolerance: "low",
      visitDate: "2026-09-12",
    });
    const itinerary = generateItinerary(intent, {
      idFactory: () => `id-${++seq}`,
      visitDate: "2026-09-12",
    });
    const ngay = new Set(
      itinerary.items.map((item) => item.startAt.slice(0, 10)),
    );
    expect(ngay.size).toBeLessThanOrEqual(1);
    expect(itinerary.totalMinutes).toBeLessThanOrEqual(600);
  });
});
