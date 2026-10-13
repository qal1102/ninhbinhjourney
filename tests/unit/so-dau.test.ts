import { describe, expect, it } from "vitest";
import { dauTuDuongDan, diemConThieu, docSoDau, duongDanDau, SO_DAU, soDauDaCo, themDau } from "@/domain/so-dau";
import { PACKAGES } from "@/content/packages";
import { DESTINATIONS } from "@/content/destinations";

describe("sổ dấu", () => {
  it("đường dẫn QR phải đúng khoá, gõ tên điểm không thì không đóng được", () => {
    expect(dauTuDuongDan("hoa-lu-l5h")?.ma).toBe("hoa-lu");
    expect(dauTuDuongDan("HOA-LU-L5H")?.ma).toBe("hoa-lu");
    expect(dauTuDuongDan("hoa-lu")).toBeUndefined();
    expect(dauTuDuongDan("loi-hua-null")).toBeUndefined();
    expect(duongDanDau("https://x.vn/", SO_DAU[0])).toBe("https://x.vn/dau/trang-an-t7a");
  });

  it("đã có dấu thì giữ ngày lần đầu", () => {
    const lan1 = themDau({}, "trang-an", "2026-10-13");
    expect(lan1.moi).toBe(true);
    const lan2 = themDau(lan1.so, "trang-an", "2026-10-20");
    expect(lan2.moi).toBe(false);
    expect(lan2.so["trang-an"]).toBe("2026-10-13");
  });

  it("bộ nhớ hỏng hay lạ thì sổ trống, không vỡ trang", () => {
    expect(docSoDau("{hong")).toEqual({});
    expect(docSoDau(JSON.stringify({ "trang-an": "2026-10-13", "la": "2026-10-13", "tam-coc": 5 }))).toEqual({ "trang-an": "2026-10-13" });
    expect(docSoDau(null)).toEqual({});
  });

  it("điểm còn thiếu dấu là điểm bán vé, trỏ đúng vé lẻ và trang điểm đến có thật", () => {
    const thieu = diemConThieu({ "trang-an": "2026-10-13" }).map((d) => d.ma);
    expect(thieu).toEqual(["tam-coc", "bai-dinh", "tam-chuc"]);
    for (const dau of SO_DAU) {
      if (dau.veSlug) expect(PACKAGES.some((p) => p.slug === dau.veSlug), dau.ma).toBe(true);
      if (dau.diemDen) expect(DESTINATIONS.some((d) => d.slug === dau.diemDen), dau.ma).toBe(true);
    }
    expect(soDauDaCo({ "trang-an": "2026-10-13", "loi-hua": "2026-10-13" })).toBe(2);
  });
});
