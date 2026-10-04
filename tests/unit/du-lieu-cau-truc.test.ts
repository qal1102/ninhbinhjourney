import { describe, expect, it } from "vitest";
import { chuoiJsonLd, jsonLdDiemDen, jsonLdDoanhNghiep, jsonLdGoi, thoiLuongIso } from "@/domain/du-lieu-cau-truc";

describe("dữ liệu có cấu trúc cho máy tìm kiếm", () => {
  it("điểm đến là TouristAttraction có toạ độ", () => {
    const d = jsonLdDiemDen({ ten: "Tràng An", moTa: "Thuyền qua hang.", url: "https://x/destination/trang-an", anh: "https://x/a.jpg", toaDo: [20.25, 105.9] });
    expect(d["@type"]).toBe("TouristAttraction");
    expect(d.geo).toEqual({ "@type": "GeoCoordinates", latitude: 20.25, longitude: 105.9 });
  });

  it("gói là TouristTrip, có lịch các điểm, không kèm giá minh hoạ", () => {
    const g = jsonLdGoi({
      ten: "Di sản trong một ngày",
      moTa: "Tràng An và Hoa Lư.",
      url: "https://x/packages/heritage-day",
      anh: "https://x/b.jpg",
      thoiLuongPhut: 600,
      cacDiem: ["Tràng An", "Cố đô Hoa Lư"],
      nhaToChuc: { ten: "Ninh Bình Journey", url: "https://x/" },
    });
    expect(g["@type"]).toBe("TouristTrip");
    expect(g.duration).toBe("PT10H");
    expect(g.itinerary.itemListElement.map((x) => x.item.name)).toEqual(["Tràng An", "Cố đô Hoa Lư"]);
    expect(JSON.stringify(g)).not.toMatch(/offers|price/i);
  });

  it("doanh nghiệp có số điện thoại, không có email (email cố ý không nằm trong HTML)", () => {
    const o = jsonLdDoanhNghiep({ ten: "Ninh Bình Journey", url: "https://x/", anh: "https://x/c.jpg", dienThoai: "0229 387 6930", moTa: "…" });
    expect(o.telephone).toBe("0229 387 6930");
    expect(JSON.stringify(o)).not.toMatch(/email|@hn\.vnn/);
  });

  it("thời lượng ISO 8601", () => {
    expect(thoiLuongIso(120)).toBe("PT2H");
    expect(thoiLuongIso(150)).toBe("PT2H30M");
    expect(thoiLuongIso(45)).toBe("PT45M");
  });

  it("thoát dấu < để không đóng thẻ script sớm", () => {
    expect(chuoiJsonLd({ a: "</script><b>" })).not.toContain("</script>");
  });
});
