import { describe, expect, it } from "vitest";
import { duBaoTuCacNgay, ngayCungThuTruoc } from "@/domain/du-bao-do-dong";

const GIO = [7, 8, 9, 10] as const;

describe("dự báo độ đông theo ngày đi", () => {
  it("lấy đúng những ngày cùng thứ đã qua", () => {
    expect(ngayCungThuTruoc("2026-10-18", "2026-10-11", 3)).toEqual(["2026-10-04", "2026-09-27", "2026-09-20"]);
    // Ngày đi là thứ Bảy tuần này: ngày cùng thứ tuần trước vẫn chưa qua so với hôm nay thì bỏ.
    expect(ngayCungThuTruoc("2026-10-17", "2026-10-10", 2)).toEqual(["2026-10-03", "2026-09-26"]);
  });

  it("chưa đủ hai ngày có số thì không dự báo", () => {
    expect(duBaoTuCacNgay("2026-10-18", GIO, [[0, 5, 9, 2], [0, 0, 0, 0]])).toBeNull();
  });

  it("chia trung bình theo số ngày có số, chỉ ra giờ đông và giờ vắng", () => {
    const du = duBaoTuCacNgay("2026-10-18", GIO, [[0, 10, 40, 4], [0, 20, 60, 6], [0, 0, 0, 0]]);
    expect(du).toMatchObject({ theoGio: [0, 15, 50, 5], soNgay: 2, dinh: 9, vangNhat: 10 });
    expect(du?.mucTheoGio).toEqual(["vang", "vang", "dong", "vang"]);
  });
});
