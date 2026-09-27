import { describe, expect, it } from "vitest";

import { cacKhoangPhieu, chonKhoangPhieu } from "@/domain/customer-funnel";

// 12:00 trưa 27/09/2026 giờ Việt Nam, hai ngày sau Trung thu 2026 (25/09).
const BAY_GIO = new Date("2026-09-27T05:00:00.000Z");
const NGAY = 86_400_000;

describe("Khoảng thời gian của phễu khách", () => {
  it("mặc định là bảy ngày gần nhất, so với bảy ngày liền trước", () => {
    const k = chonKhoangPhieu(undefined, BAY_GIO);
    expect(k.ma).toBe("7-ngay");
    expect(k.den).toEqual(BAY_GIO);
    expect(BAY_GIO.getTime() - k.tu.getTime()).toBe(7 * NGAY);
    expect(k.soSanh.den).toEqual(k.tu);
    expect(k.tu.getTime() - k.soSanh.tu.getTime()).toBe(7 * NGAY);
  });

  it("mã lạ hay mã dịp chưa diễn ra thì lùi về bảy ngày, không ném lỗi", () => {
    expect(chonKhoangPhieu("365-ngay", BAY_GIO).ma).toBe("7-ngay");
    expect(chonKhoangPhieu("dip-tet-nguyen-dan-2027", BAY_GIO).ma).toBe("7-ngay");
  });

  it("Trung thu 2026 tính từ hai tuần trước dịp tới hết ngày rằm, so với Trung thu 2025 cùng độ dài", () => {
    const k = chonKhoangPhieu("dip-trung-thu-2026", BAY_GIO);
    expect(k.nhan).toBe("Tết Trung thu 2026");
    // 11/09/2026 00:00 và 26/09/2026 00:00 giờ Việt Nam.
    expect(k.tu.toISOString()).toBe("2026-09-10T17:00:00.000Z");
    expect(k.den.toISOString()).toBe("2026-09-25T17:00:00.000Z");
    // Trung thu 2025 rơi vào 06/10/2025; khoảng so bắt đầu 22/09/2025.
    expect(k.soSanh.nhan).toBe("Tết Trung thu 2025");
    expect(k.soSanh.tu.toISOString()).toBe("2025-09-21T17:00:00.000Z");
    expect(k.soSanh.den.getTime() - k.soSanh.tu.getTime()).toBe(k.den.getTime() - k.tu.getTime());
  });

  it("dịp đang diễn ra thì khoảng dừng ở lúc này", () => {
    // 25/09/2026 lúc 10:00 giờ Việt Nam, giữa ngày rằm.
    const giuaDip = new Date("2026-09-25T03:00:00.000Z");
    const k = chonKhoangPhieu("dip-trung-thu-2026", giuaDip);
    expect(k.den).toEqual(giuaDip);
    expect(k.moTa).toContain("đang diễn ra");
  });

  it("danh sách chỉ có các dịp đã bắt đầu trong mười hai tháng qua, mới nhất trước", () => {
    const ds = cacKhoangPhieu(BAY_GIO);
    expect(ds.slice(0, 3).map((l) => l.ma)).toEqual(["7-ngay", "30-ngay", "90-ngay"]);
    const dip = ds.filter((l) => l.nhom === "dip");
    expect(dip[0].ma).toBe("dip-trung-thu-2026");
    expect(dip.map((l) => l.ma)).not.toContain("dip-trung-thu-2025");
    // Quốc khánh 02/09/2026 đã qua, Tết dương 2027 chưa tới.
    expect(dip.map((l) => l.ma)).toContain("dip-quoc-khanh-2026");
    expect(dip.map((l) => l.ma)).not.toContain("dip-tet-duong-lich-2027");
    for (const l of dip) expect(chonKhoangPhieu(l.ma, BAY_GIO).ma).toBe(l.ma);
  });
});
