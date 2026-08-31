import { describe, expect, it } from "vitest";
import {
  changePercent,
  rollingWindow,
  vietnamDayKey,
  vietnamDayStart,
  vietnamTodayWindow,
  vietnamYesterdayWindow,
} from "@/domain/ticket-window";

describe("khung ngày Việt Nam", () => {
  it("lấy đúng ngày theo giờ Việt Nam chứ không theo giờ UTC", () => {
    // 31/08 lúc 18:30 UTC đã là 01/09 ở Việt Nam. Nếu chỗ này đọc theo UTC
    // thì cả buổi tối bán vé sẽ bị cộng nhầm vào ngày hôm trước.
    const toiMuon = new Date("2026-08-31T18:30:00Z");
    expect(vietnamDayKey(toiMuon)).toBe("2026-09-01");
  });

  it("giữ đúng ngày khi thời điểm còn nằm trong ngày Việt Nam", () => {
    const sang = new Date("2026-08-31T02:00:00Z");
    expect(vietnamDayKey(sang)).toBe("2026-08-31");
  });

  it("mốc đầu ngày là 0 giờ giờ Việt Nam, tức 17 giờ hôm trước theo UTC", () => {
    const at = new Date("2026-08-31T09:00:00Z");
    expect(vietnamDayStart(at, 0).toISOString()).toBe("2026-08-30T17:00:00.000Z");
  });

  it("hôm qua kết thúc đúng lúc hôm nay bắt đầu, không hở và không chồng", () => {
    const at = new Date("2026-08-31T09:00:00Z");
    const homNay = vietnamTodayWindow(at);
    const homQua = vietnamYesterdayWindow(at);
    expect(homQua.to.getTime()).toBe(homNay.from.getTime());
    expect(homQua.from.toISOString()).toBe("2026-08-29T17:00:00.000Z");
    expect(homNay.to).toBe(at);
  });

  it("cửa sổ hôm nay không kéo sang tương lai", () => {
    const at = new Date("2026-08-31T09:00:00Z");
    expect(vietnamTodayWindow(at).to.getTime()).toBe(at.getTime());
  });
});

describe("cửa sổ trượt", () => {
  const at = new Date("2026-08-31T09:00:00Z");

  it("bảy ngày qua tính ngược đúng bảy ngày từ bây giờ", () => {
    const window = rollingWindow(at, 7);
    expect(window.to.getTime()).toBe(at.getTime());
    expect(window.from.toISOString()).toBe("2026-08-24T09:00:00.000Z");
  });

  it("cửa sổ liền trước dán sát cửa sổ hiện tại, không đếm trùng ngày nào", () => {
    const hienTai = rollingWindow(at, 7);
    const lienTruoc = rollingWindow(at, 7, 1);
    expect(lienTruoc.to.getTime()).toBe(hienTai.from.getTime());
    expect(lienTruoc.from.toISOString()).toBe("2026-08-17T09:00:00.000Z");
  });

  it("ba mươi ngày cũng theo đúng cách ấy", () => {
    const lienTruoc = rollingWindow(at, 30, 1);
    expect(lienTruoc.to.toISOString()).toBe("2026-08-01T09:00:00.000Z");
    expect(lienTruoc.from.toISOString()).toBe("2026-07-02T09:00:00.000Z");
  });
});

describe("so với kỳ trước", () => {
  it("kỳ trước bằng không thì không có phần trăm nào để nói", () => {
    expect(changePercent(12, 0)).toBeNull();
  });

  it("tăng thì dương, giảm thì âm", () => {
    expect(changePercent(120, 100)).toBe(20);
    expect(changePercent(80, 100)).toBe(-20);
  });

  it("làm tròn tới một chữ số sau dấu phẩy", () => {
    expect(changePercent(1, 3)).toBe(-66.7);
    expect(changePercent(4, 3)).toBe(33.3);
  });

  it("đứng yên thì bằng không, không phải null", () => {
    expect(changePercent(50, 50)).toBe(0);
  });
});
