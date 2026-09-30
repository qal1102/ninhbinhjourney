import { describe, expect, it } from "vitest";
import { destinations } from "@/content/landing-destinations";
import { docKhoangCach, khoangCachMet, noiDangO, xepTheoKhoangCach } from "@/domain/thuyet-minh-vi-tri";

const diem = destinations.map((d) => ({ id: d.id, viTri: d.position }));

describe("thuyết minh theo vị trí", () => {
  it("tính khoảng cách đúng cỡ", () => {
    // Một phần nghìn độ vĩ ≈ 111 m.
    expect(Math.round(khoangCachMet([20, 105], [20.001, 105]))).toBe(111);
    expect(khoangCachMet([20.25, 105.9], [20.25, 105.9])).toBe(0);
  });

  it("đứng ở bến Tràng An thì nhận ra Tràng An", () => {
    const trangAn = destinations.find((d) => d.id === "trang_an")!;
    const [lat, lng] = trangAn.position;
    expect(noiDangO(diem, [lat + 0.003, lng])?.diem.id).toBe("trang_an");
  });

  it("ở Hà Nội thì không ở nơi nào, nhưng vẫn xếp được nơi gần nhất", () => {
    expect(noiDangO(diem, [21.0285, 105.8542])).toBeNull();
    const xep = xepTheoKhoangCach(diem, [21.0285, 105.8542]);
    expect(xep).toHaveLength(diem.length);
    expect(xep[0].met).toBeLessThanOrEqual(xep[1].met);
  });

  it("viết khoảng cách theo thói quen từng ngôn ngữ", () => {
    expect(docKhoangCach(324, "vi")).toBe("320 m");
    expect(docKhoangCach(1500, "vi")).toBe("1,5 km");
    expect(docKhoangCach(1500, "en")).toBe("1.5 km");
    expect(docKhoangCach(23_400, "en")).toBe("23 km");
  });
});
