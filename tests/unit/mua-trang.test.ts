import { describe, expect, it } from "vitest";

import {
  loiTinhTrang,
  ngayVN,
  soDem,
  tinhTrangMua,
} from "@/domain/mua-trang";

const DEM = ["2026-09-18", "2026-09-25", "2026-09-27"] as const;
const RAM = "2026-09-25";

/** Một thời điểm UTC bất kỳ trong ngày. */
function luc(iso: string, gioUTC = 10) {
  return new Date(`${iso}T${String(gioUTC).padStart(2, "0")}:00:00Z`);
}

describe("Ngày ở giờ Việt Nam", () => {
  it("nửa đêm UTC vẫn là ngày hôm sau ở Việt Nam", () => {
    // 17/09 23:00 UTC = 18/09 06:00 giờ Việt Nam. Nếu lấy ngày UTC thì mùa mở
    // muộn mất một đêm đối với chính người đang đứng ở Ninh Bình.
    expect(ngayVN(new Date("2026-09-17T23:00:00Z"))).toBe("2026-09-18");
  });

  it("đếm đêm hai chiều", () => {
    expect(soDem("2026-09-22", "2026-09-25")).toBe(3);
    expect(soDem("2026-09-27", "2026-09-25")).toBe(-2);
    expect(soDem("2026-09-25", "2026-09-25")).toBe(0);
  });
});

describe("Giai đoạn của mùa trăng", () => {
  it("trước mùa thì đếm ngược tới đêm mở mùa", () => {
    const tt = tinhTrangMua(luc("2026-09-15"), DEM, RAM);
    expect(tt.giaiDoan).toBe("truoc-mua");
    expect(tt.conMayDem).toBe(3);
    expect(loiTinhTrang(tt, "vi")).toBe("Còn 3 đêm nữa mở mùa");
  });

  it("trong mùa thì đếm ngược tới rằm", () => {
    // Đúng ngày chủ dự án mở web và hỏi vì sao vòng trăng không tự biết.
    const tt = tinhTrangMua(luc("2026-09-22"), DEM, RAM);
    expect(tt.giaiDoan).toBe("trong-mua");
    expect(tt.conMayDem).toBe(3);
    expect(tt.hienToiNay).toBe(true);
    expect(loiTinhTrang(tt, "vi")).toBe("Đang trong mùa · còn 3 đêm nữa tới rằm");
  });

  it("đúng đêm rằm thì nói thẳng, không đếm ngược 0 đêm", () => {
    const tt = tinhTrangMua(luc("2026-09-25", 15), DEM, RAM);
    expect(tt.giaiDoan).toBe("dung-ram");
    expect(loiTinhTrang(tt, "vi")).toBe("Đêm nay là rằm");
    expect(loiTinhTrang(tt, "en")).toBe("Tonight is the full moon");
  });

  it("qua rằm thì đếm ngược tới đêm khép mùa", () => {
    const tt = tinhTrangMua(luc("2026-09-26"), DEM, RAM);
    expect(tt.giaiDoan).toBe("qua-ram");
    expect(tt.conMayDem).toBe(1);
    expect(loiTinhTrang(tt, "vi")).toBe("Qua rằm · còn một đêm nữa khép mùa");
  });

  it("hết mùa thì thôi đếm", () => {
    const tt = tinhTrangMua(luc("2026-10-02"), DEM, RAM);
    expect(tt.giaiDoan).toBe("het-mua");
    expect(tt.conMayDem).toBe(0);
    expect(loiTinhTrang(tt, "vi")).toBe("Mùa trăng năm nay đã khép");
  });

  it("chỉ mở sẵn đêm 'tối nay' quanh mùa, không mở quanh năm", () => {
    // Khách vào tháng Ba không cần biết trăng đêm nay khuyết bao nhiêu; họ cần
    // thấy đêm rằm của mùa.
    expect(tinhTrangMua(luc("2026-09-12"), DEM, RAM).hienToiNay).toBe(true);
    expect(tinhTrangMua(luc("2026-09-10"), DEM, RAM).hienToiNay).toBe(false);
    expect(tinhTrangMua(luc("2026-10-04"), DEM, RAM).hienToiNay).toBe(true);
    expect(tinhTrangMua(luc("2026-10-05"), DEM, RAM).hienToiNay).toBe(false);
    expect(tinhTrangMua(luc("2026-03-01"), DEM, RAM).hienToiNay).toBe(false);
  });

  it("đêm gần nhất bám theo hôm nay chứ không đứng yên ở rằm", () => {
    expect(tinhTrangMua(luc("2026-09-19"), DEM, RAM).demGanNhat).toBe(0);
    expect(tinhTrangMua(luc("2026-09-24"), DEM, RAM).demGanNhat).toBe(1);
    expect(tinhTrangMua(luc("2026-09-28"), DEM, RAM).demGanNhat).toBe(2);
  });

  it("mọi giai đoạn đều có lời cho cả hai thứ tiếng", () => {
    for (const ngay of ["2026-09-15", "2026-09-22", "2026-09-25", "2026-09-26", "2026-10-02"]) {
      const tt = tinhTrangMua(luc(ngay), DEM, RAM);
      for (const lang of ["vi", "en"] as const) {
        expect(loiTinhTrang(tt, lang)).toBeTruthy();
        expect(loiTinhTrang(tt, lang)).not.toMatch(/undefined|NaN/);
      }
    }
  });
});
