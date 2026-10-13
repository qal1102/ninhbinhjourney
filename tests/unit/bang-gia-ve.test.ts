import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apBangGia, CAC_GOI, PACKAGES, VE_LE } from "@/content/packages";
import { cauGiaVe } from "@/domain/hoi-dap";

/*
 * Giá vé một nguồn (13/10/2026, migration 124): giá web bằng giá quầy. Kho tính
 * giá thật; giá trong danh mục chỉ là dự phòng, nhưng phải khớp bảng giá quầy
 * gieo sẵn để web không nói một đằng khi chưa nối kho.
 */
const GIA_QUAY: Record<string, number> = {
  "10000000-0000-4000-8000-000000000001": 250_000, // Tràng An
  "10000000-0000-4000-8000-000000000005": 200_000, // Tam Cốc
  "10000000-0000-4000-8000-000000000009": 200_000, // Tam Chúc
  "10000000-0000-4000-8000-000000000003": 60_000, // Bái Đính
};

describe("giá vé một nguồn", () => {
  it("giá dự phòng của vé lẻ và gói bằng tổng giá quầy các điểm (trừ Bàn Trăng)", () => {
    for (const item of PACKAGES) {
      if (item.slug === "ban-trang-tam-coc-2026") continue;
      const tong = item.siteIds.reduce((cong, id) => cong + (GIA_QUAY[id] ?? 0), 0);
      expect(item.demoPriceVnd, item.slug).toBe(tong);
    }
  });

  it("có bốn vé lẻ, mỗi vé một điểm, và gói không lẫn vé lẻ", () => {
    expect(VE_LE.map((v) => v.slug)).toEqual(["ve-trang-an", "ve-tam-coc", "ve-tam-chuc", "ve-bai-dinh"]);
    expect(VE_LE.every((v) => v.siteIds.length === 1)).toBe(true);
    expect(CAC_GOI.some((g) => g.loai === "ve")).toBe(false);
  });

  it("áp bảng giá từ kho, thiếu thì giữ dự phòng", () => {
    const ve = VE_LE[0];
    expect(apBangGia(ve, { "ve-trang-an": 300_000 }).demoPriceVnd).toBe(300_000);
    expect(apBangGia(ve, null)).toBe(ve);
    expect(apBangGia(ve, {})).toBe(ve);
  });

  it("câu trả lời giá vé lấy theo bảng giá hiện hành", () => {
    expect(cauGiaVe({ "ve-trang-an": 300_000 }, "vi")).toContain("Vé Tràng An 300.000 đ");
    expect(cauGiaVe(null, "vi")).toContain("Vé Bái Đính 60.000 đ");
    expect(cauGiaVe(null, "vi")).not.toMatch(/minh hoạ/);
  });

  it("migration 124 gieo đúng bốn vé lẻ khớp danh mục", () => {
    const sql = readFileSync("supabase/migrations/202610130124_gia_ve_mot_nguon.sql", "utf8");
    for (const ve of VE_LE) {
      expect(sql).toContain(`'${ve.id}'`);
      expect(sql).toContain(`'${ve.slug}'`);
    }
  });
});
