import { describe, expect, it } from "vitest";
import {
  MID_AUTUMN_SEASON_CLOSES_AT_ISO,
  isMidAutumnSeasonOpen,
} from "@/lib/seasonal/mid-autumn-season";

/**
 * A15-TRUNG-THU-01 (phần còn lại, 18/09/2026). Bàn Trăng chỉ bán
 * 18–27/09/2026 (`content/packages.ts` `bookingEndDate`, CSDL ép lại đúng
 * mốc này ở tầng giữ chỗ), nên cổng trang chủ, hộp trợ lý hành trình và
 * `/seasonal/mid-autumn` đều tắt theo đúng một mốc: hết 27/09/2026 23:59
 * giờ Việt Nam.
 */
describe("isMidAutumnSeasonOpen", () => {
  it("còn trong mùa ở đúng phút cuối cùng — 27/09/2026 23:59 giờ VN", () => {
    expect(isMidAutumnSeasonOpen(new Date("2026-09-27T23:59:00+07:00"))).toBe(true);
    expect(isMidAutumnSeasonOpen(new Date("2026-09-27T23:59:59+07:00"))).toBe(true);
  });

  it("đã khép đúng lúc 00:00 ngày 28/09/2026 giờ VN", () => {
    expect(isMidAutumnSeasonOpen(new Date("2026-09-28T00:00:00+07:00"))).toBe(false);
  });

  it("còn mở suốt cửa sổ bán Bàn Trăng, 18–27/09/2026", () => {
    expect(isMidAutumnSeasonOpen(new Date("2026-09-18T00:00:00+07:00"))).toBe(true);
    expect(isMidAutumnSeasonOpen(new Date("2026-09-25T00:00:00+07:00"))).toBe(true); // rằm Trung thu
    expect(isMidAutumnSeasonOpen(new Date("2026-09-27T00:00:01+07:00"))).toBe(true);
  });

  it("đã khép hẳn từ 28/09 trở đi, kể cả sau đó rất lâu", () => {
    expect(isMidAutumnSeasonOpen(new Date("2026-09-28T00:00:01+07:00"))).toBe(false);
    expect(isMidAutumnSeasonOpen(new Date("2026-10-01T00:00:00+07:00"))).toBe(false);
    expect(isMidAutumnSeasonOpen(new Date("2027-09-01T00:00:00+07:00"))).toBe(false);
  });

  it("chưa tới mùa vẫn tính là mở — hàm chỉ canh mốc khép, không canh mốc mở", () => {
    // Mốc mở bán (18/09) đã qua ở tình huống thật của A15-TRUNG-THU-01, nhưng
    // hàm dùng chung một biên duy nhất là mốc KHÉP; một ngày xa trước đó vẫn
    // hợp lệ vì trang không tự ẩn trước khi mùa bắt đầu.
    expect(isMidAutumnSeasonOpen(new Date("2026-01-01T00:00:00+07:00"))).toBe(true);
  });

  it("không nhảy ngày khi máy chủ chạy UTC quanh nửa đêm giờ VN — biên UTC-vs-VN", () => {
    // 27/09 23:59:59 giờ VN = 27/09 16:59:59 UTC -- còn trong mùa.
    expect(isMidAutumnSeasonOpen(new Date("2026-09-27T16:59:59Z"))).toBe(true);
    // 28/09 00:00:00 giờ VN = 27/09 17:00:00 UTC -- đã khép, dù ngày UTC vẫn
    // còn là 27/09. Lấy mốc theo ngày UTC thay vì theo giờ VN sẽ sai đúng ở
    // điểm này.
    expect(isMidAutumnSeasonOpen(new Date("2026-09-27T17:00:00Z"))).toBe(false);
  });

  it("nhận số mili-giây (epoch) giống hệt nhận đối tượng Date", () => {
    const bienDong = new Date("2026-09-28T00:00:00+07:00").getTime();
    expect(isMidAutumnSeasonOpen(bienDong - 1)).toBe(true);
    expect(isMidAutumnSeasonOpen(bienDong)).toBe(false);
  });

  it("hằng số mốc khép đúng như đã khai — 00:00 28/09/2026 giờ VN", () => {
    expect(MID_AUTUMN_SEASON_CLOSES_AT_ISO).toBe("2026-09-28T00:00:00+07:00");
  });
});
