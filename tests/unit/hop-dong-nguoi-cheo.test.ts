import { describe, expect, it } from "vitest";
import { ganNguoiCheo, trangThaiHopDong, trongHopDong, type NguoiCheo } from "@/domain/thuyen-song";

/*
 * Hợp đồng người chèo (12/10/2026, migration 120): người hết hợp đồng hay chưa
 * tới ngày bắt đầu không vào lượt gọi; còn dưới 14 ngày thì báo sắp hết.
 */

const nguoi = (so: string, hopDong: Partial<NguoiCheo> = {}): NguoiCheo => ({
  id: `n-${so}`,
  soThuyen: so,
  hoTen: `Người ${so}`,
  soDienThoai: null,
  laMau: true,
  queQuan: null,
  namVaoNghe: null,
  ngonNgu: null,
  ghiChu: null,
  ...hopDong,
});

describe("trạng thái hợp đồng", () => {
  it("dài hạn không ghi ngày hết là còn hạn, không đếm ngày", () => {
    expect(trangThaiHopDong(nguoi("1"), "2026-10-12")).toEqual({ loai: "con-han", conNgay: null });
  });

  it("ngày hết hạn vẫn tính là còn; qua một ngày là hết", () => {
    const n = nguoi("1", { loaiHopDong: "thoi-vu", hopDongTu: "2026-09-01", hopDongDen: "2026-10-20" });
    expect(trangThaiHopDong(n, "2026-10-20")).toEqual({ loai: "sap-het", conNgay: 0 });
    expect(trangThaiHopDong(n, "2026-10-21")).toEqual({ loai: "het-han", quaNgay: 1 });
  });

  it("còn đúng 14 ngày là sắp hết, 15 ngày thì chưa", () => {
    const n = nguoi("1", { hopDongDen: "2026-10-26" });
    expect(trangThaiHopDong(n, "2026-10-12").loai).toBe("sap-het");
    expect(trangThaiHopDong(n, "2026-10-11")).toEqual({ loai: "con-han", conNgay: 15 });
  });

  it("chưa tới ngày bắt đầu thì chưa vào lượt", () => {
    const n = nguoi("1", { hopDongTu: "2026-11-01", hopDongDen: "2026-12-31" });
    expect(trangThaiHopDong(n, "2026-10-12")).toEqual({ loai: "chua-bat-dau", conNgay: 20 });
    expect(trongHopDong(n, "2026-10-12")).toBe(false);
  });
});

describe("lượt gọi bỏ qua người ngoài hợp đồng", () => {
  const PHUT = 60_000;
  // 08:00 giờ Việt Nam ngày 12/10/2026.
  const tamGio = Date.parse("2026-10-12T01:00:00Z");
  const chuyen = (id: string, roi: number) => ({ id, soKhach: 2, roiBenLuc: tamGio + roi * PHUT, veBenLuc: tamGio + (roi + 100) * PHUT, heSo: 1 });

  it("người hết hợp đồng cuối tháng 8 không nhận chuyến; người kế nhận thay", () => {
    const so = [
      nguoi("1", { loaiHopDong: "thoi-vu", hopDongTu: "2026-05-01", hopDongDen: "2026-08-31" }),
      nguoi("2"),
      nguoi("3", { hopDongTu: "2026-11-01" }),
      nguoi("4", { loaiHopDong: "thoi-vu", hopDongTu: "2026-09-01", hopDongDen: "2026-12-31" }),
    ];
    const gan = ganNguoiCheo([chuyen("a", 0), chuyen("b", 5), chuyen("c", 10)], so);
    expect(gan.get("a")?.soThuyen).toBe("2");
    expect(gan.get("b")?.soThuyen).toBe("4");
    // Chỉ còn hai người trong hợp đồng, cả hai đang trên sông.
    expect(gan.has("c")).toBe(false);
    expect([...gan.values()].some((n) => n.soThuyen === "1" || n.soThuyen === "3")).toBe(false);
  });

  it("sổ chưa có hợp đồng (kho cũ) thì ai cũng vào lượt như trước", () => {
    const gan = ganNguoiCheo([chuyen("a", 0), chuyen("b", 5)], [nguoi("1"), nguoi("2")]);
    expect(gan.size).toBe(2);
  });
});
