import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apBangGia, CAC_GOI, GIA_DIEM_DU_PHONG, PACKAGES, phanTramGiamGoi, tinhGiaGoi, VE_LE } from "@/content/packages";
import { cauGiaVe } from "@/domain/hoi-dap";
import { chuanHoaMaMoi, giamMaMoi } from "@/domain/ma-moi";

/*
 * Giá vé một nguồn (13/10/2026, migration 124, 125): giá web bằng giá quầy. Kho
 * tính giá thật; giá trong danh mục chỉ là dự phòng, nhưng phải khớp bảng giá
 * quầy gieo sẵn để web không nói một đằng khi chưa nối kho.
 */
const GIA_QUAY: Record<string, { lon: number; nho: number }> = {
  "10000000-0000-4000-8000-000000000001": { lon: 250_000, nho: 120_000 }, // Tràng An
  "10000000-0000-4000-8000-000000000005": { lon: 200_000, nho: 100_000 }, // Tam Cốc
  "10000000-0000-4000-8000-000000000009": { lon: 200_000, nho: 100_000 }, // Tam Chúc
  "10000000-0000-4000-8000-000000000003": { lon: 60_000, nho: 30_000 }, // Bái Đính
};

describe("giá vé một nguồn", () => {
  it("giá dự phòng từng điểm khớp bảng giá quầy (người lớn 069, trẻ 1m–1m3 125)", () => {
    for (const [id, gia] of Object.entries(GIA_QUAY)) {
      expect(GIA_DIEM_DU_PHONG[id]).toEqual({ nguoiLon: gia.lon, treEm: gia.nho });
    }
    const sql = readFileSync("supabase/migrations/202610130125_gia_tre_em_goi_ma_moi.sql", "utf8");
    for (const [id, gia] of Object.entries(GIA_QUAY)) {
      expect(sql).toContain(`('${id}', ${gia.nho},`);
    }
  });

  it("giá dự phòng của gói bằng tổng giá quầy, gói 2 điểm bán vé giảm 10% (trừ Bàn Trăng)", () => {
    for (const item of PACKAGES) {
      if (item.giaRieng) continue;
      const tong = item.siteIds.reduce((cong, id) => cong + (GIA_QUAY[id]?.lon ?? 0), 0);
      const soDiem = item.siteIds.filter((id) => GIA_QUAY[id]).length;
      const giam = phanTramGiamGoi(soDiem);
      const mong = giam ? Math.floor((tong * (100 - giam)) / 100_000) * 1000 : tong;
      expect(item.demoPriceVnd, item.slug).toBe(mong);
    }
  });

  it("gói gia đình 279.000, trẻ 135.000; gói hai dòng sông 405.000, mua lẻ 450.000", () => {
    const giaDinh = PACKAGES.find((p) => p.slug === "family-discovery")!;
    expect(tinhGiaGoi(giaDinh.siteIds)).toEqual({ nguoiLon: 279_000, treEm: 135_000, giaLe: 310_000, giam: 10 });
    const haiSong = PACKAGES.find((p) => p.slug === "trang-an-tam-coc-trong-ngay")!;
    expect(tinhGiaGoi(haiSong.siteIds)).toEqual({ nguoiLon: 405_000, treEm: 198_000, giaLe: 450_000, giam: 10 });
    expect(phanTramGiamGoi(3)).toBe(15);
    expect(phanTramGiamGoi(1)).toBe(0);
  });

  it("có bốn vé lẻ, mỗi vé một điểm, và gói không lẫn vé lẻ", () => {
    expect(VE_LE.map((v) => v.slug)).toEqual(["ve-trang-an", "ve-tam-coc", "ve-tam-chuc", "ve-bai-dinh"]);
    expect(VE_LE.every((v) => v.siteIds.length === 1)).toBe(true);
    expect(CAC_GOI.some((g) => g.loai === "ve")).toBe(false);
  });

  it("áp bảng giá từ kho, thiếu thì tính từ giá dự phòng từng điểm", () => {
    const ve = VE_LE[0];
    const tuKho = apBangGia(ve, { "ve-trang-an": { nguoiLon: 300_000, treEm: 150_000, giaLe: 300_000, giam: 0 } });
    expect(tuKho.demoPriceVnd).toBe(300_000);
    expect(tuKho.giaTreEmVnd).toBe(150_000);
    expect(apBangGia(ve, null).giaTreEmVnd).toBe(120_000);
    expect(apBangGia(ve, {}).demoPriceVnd).toBe(250_000);
    const banTrang = PACKAGES.find((p) => p.giaRieng)!;
    expect(apBangGia(banTrang, null)).toBe(banTrang);
  });

  it("câu trả lời giá vé lấy theo bảng giá hiện hành", () => {
    expect(cauGiaVe({ "ve-trang-an": { nguoiLon: 300_000, treEm: 150_000, giaLe: 300_000, giam: 0 } }, "vi")).toContain("Vé Tràng An 300.000 đ");
    expect(cauGiaVe(null, "vi")).toContain("Vé Bái Đính 60.000 đ");
    expect(cauGiaVe(null, "vi")).not.toMatch(/minh hoạ|dưới 1m3 miễn phí/);
  });

  it("migration 124 gieo đúng bốn vé lẻ khớp danh mục", () => {
    const sql = readFileSync("supabase/migrations/202610130124_gia_ve_mot_nguon.sql", "utf8");
    for (const ve of VE_LE) {
      expect(sql).toContain(`'${ve.id}'`);
      expect(sql).toContain(`'${ve.slug}'`);
    }
  });
});

describe("mã mời", () => {
  it("chuẩn hoá mã, sai khuôn thì bỏ", () => {
    expect(chuanHoaMaMoi(" moi-ab12cd ")).toBe("MOI-AB12CD");
    expect(chuanHoaMaMoi("MOI-AB12C")).toBeNull();
    expect(chuanHoaMaMoi("NBJ-AB12CD")).toBeNull();
    expect(chuanHoaMaMoi(42)).toBeNull();
  });

  it("giảm 10% làm tròn xuống nghìn, đúng như kho", () => {
    expect(giamMaMoi(810_000)).toBe(81_000);
    expect(giamMaMoi(693_000)).toBe(69_000);
    expect(giamMaMoi(0)).toBe(0);
  });
});
