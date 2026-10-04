import { describe, expect, it } from "vitest";
import { packageCatalogBack, readContinuityContext } from "@/lib/page-continuity";

describe("nút quay lại của danh mục gói theo đúng nơi khách vừa rời", () => {
  it("từ trang chủ thì về khu gói trên trang chủ", () => {
    const ql = packageCatalogBack(readContinuityContext({ from: "home", lang: "en" }), false);
    expect(ql.kieu).toBe("trang-chu");
    expect(ql.href).toBe("/?lang=en#packages");
  });

  it("từ Lập hành trình (from=plan hoặc có gói gợi ý) thì về lịch trình", () => {
    expect(packageCatalogBack(readContinuityContext({ from: "plan" }), false)).toEqual({ href: "/plan", kieu: "hanh-trinh" });
    expect(packageCatalogBack(readContinuityContext({}), true).kieu).toBe("hanh-trinh");
  });

  it("vào thẳng, lối đại lý hay kiosk thì về trang chủ, giữ ngôn ngữ và nguồn", () => {
    const ql = packageCatalogBack(readContinuityContext({ source: "kiosk-trang-an", lang: "vi" }), false);
    expect(ql.kieu).toBe("trang-chu");
    expect(ql.href).toBe("/?lang=vi&source=kiosk-trang-an");
  });
});
