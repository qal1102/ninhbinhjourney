import { describe, expect, it } from "vitest";
import {
  congNgay,
  docSoLieuBaoCao,
  duBao7Ngay,
  tenThu,
  tiLeKhongDen,
  tongTheoTuan,
  trungBinhTheoThu,
  xuHuong,
  type NgayBaoCao,
} from "@/domain/bao-cao-co-so";

/** 56 ngày kết thúc ở thứ bảy 26/09/2026; cuối tuần gấp đôi ngày thường. */
function chuoi(heSoGan = 1): NgayBaoCao[] {
  return Array.from({ length: 56 }, (_, i) => {
    const ngay = congNgay("2026-08-01", i);
    const thu = new Date(`${ngay}T00:00:00Z`).getUTCDay();
    const goc = thu === 0 || thu === 6 ? 200 : 100;
    const khach = Math.round(goc * (i >= 28 ? heSoGan : 1));
    return { ngay, khachVao: khach, khachCoVe: khach, khachWeb: 10, khachWebDaVao: 9, tienQuay: khach * 1000, phieuQuay: 1 };
  });
}

describe("Báo cáo & dự báo một cơ sở", () => {
  it("đọc thứ đúng theo lịch, không theo múi giờ máy", () => {
    expect(tenThu("2026-09-26")).toBe("Thứ bảy");
    expect(tenThu("2026-09-27")).toBe("Chủ nhật");
    expect(congNgay("2026-09-30", 1)).toBe("2026-10-01");
  });

  it("gộp tám tuần, tuần cuối kết thúc ở ngày cuối cùng", () => {
    const tuan = tongTheoTuan(chuoi());
    expect(tuan).toHaveLength(8);
    expect(tuan[7].tuDen).toBe("2026-09-25");
    expect(tuan[7].khach).toBe(5 * 100 + 2 * 200);
  });

  it("trung bình theo thứ thấy cuối tuần đông gấp đôi", () => {
    const tb = trungBinhTheoThu(chuoi());
    expect(tb[6]).toBe(200);
    expect(tb[3]).toBe(100);
  });

  it("xu hướng kẹp trong khoảng hợp lý", () => {
    expect(xuHuong(chuoi(1.1))).toBeCloseTo(1.1, 2);
    expect(xuHuong(chuoi(3))).toBe(1.3);
    expect(xuHuong([])).toBe(1);
  });

  it("dự báo không bao giờ thấp hơn số khách đã đặt trước", () => {
    const soLieu = {
      ngay: chuoi(),
      gio: [{ gio: 9, khach: 300 }, { gio: 14, khach: 100 }],
      daDat: [{ ngay: "2026-09-28", khach: 500 }],
      sucChuaGio: 100,
    };
    const duBao = duBao7Ngay(soLieu, "2026-09-26");
    expect(duBao[0]).toMatchObject({ thu: "Thứ bảy", khach: 200, gioCaoDiem: 9, khachGioCaoDiem: 150, phanTramSucChua: 150 });
    const thuHai = duBao.find((d) => d.ngay === "2026-09-28")!;
    expect(thuHai.khach).toBe(500);
    expect(thuHai.thap).toBe(500);
  });

  it("tỉ lệ khách web không đến", () => {
    expect(tiLeKhongDen(chuoi())).toBe(10);
    expect(tiLeKhongDen([])).toBeNull();
  });

  it("dữ liệu hỏng thì bỏ dòng, không ném lỗi", () => {
    const doc = docSoLieuBaoCao({
      ngay: [{ ngay: "2026-09-01", khach_vao: "12" }, { ngay: "hong" }, null],
      gio: [{ gio: 25, khach: 1 }, { gio: 8, khach: -3 }],
      da_dat: "khong",
      suc_chua_gio: null,
    });
    expect(doc.ngay).toEqual([{ ngay: "2026-09-01", khachVao: 12, khachCoVe: 0, khachWeb: 0, khachWebDaVao: 0, tienQuay: 0, phieuQuay: 0 }]);
    expect(doc.gio).toEqual([{ gio: 8, khach: 0 }]);
    expect(doc.daDat).toEqual([]);
    expect(doc.sucChuaGio).toBeNull();
    expect(docSoLieuBaoCao(null).ngay).toEqual([]);
  });
});
