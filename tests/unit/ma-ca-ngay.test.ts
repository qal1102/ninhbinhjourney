import { describe, expect, it } from "vitest";
import { chonVeChoMaDon, laMaDon, type VeCuaDon } from "@/domain/ma-ca-ngay";

const TA = "site-trang-an";
const BD = "site-bai-dinh";
const ve = (ma: string, site: string, ngay: string, cho: number, da: number, status = "issued"): VeCuaDon => ({
  ticket_code: ma, site_id: site, valid_on: ngay, entries_allowed: cho, entries_used: da, status,
});

describe("một mã cho cả ngày", () => {
  it("nhận mã đơn trần hoặc nằm cuối đường dẫn, bỏ qua mã vé và mã quầy", () => {
    expect(laMaDon(" nbj-abc123def456 ")).toBe("NBJ-ABC123DEF456");
    expect(laMaDon("https://x.vn/tra-cuu-ve/NBJ-ABC123DEF456?lang=en")).toBe("NBJ-ABC123DEF456");
    expect(laMaDon("NBJ-ABC123")).toBeNull();
    expect(laMaDon("WEB-ABC123DEF456")).toBeNull();
  });

  it("chọn vé của đúng cơ sở đang quét, đúng ngày, còn lượt", () => {
    const ds = [ve("V1", BD, "2026-10-11", 2, 0), ve("V2", TA, "2026-10-11", 2, 2, "used"), ve("V3", TA, "2026-10-11", 1, 0)];
    expect(chonVeChoMaDon(ds, TA, "2026-10-11")?.ticket_code).toBe("V3");
  });

  it("hết lượt ở cơ sở này thì vẫn đưa vé ở đây sang để cổng báo đã dùng", () => {
    const ds = [ve("V1", BD, "2026-10-11", 2, 0), ve("V2", TA, "2026-10-11", 2, 2, "used")];
    expect(chonVeChoMaDon(ds, TA, "2026-10-11")?.ticket_code).toBe("V2");
    expect(chonVeChoMaDon([], TA, "2026-10-11")).toBeNull();
  });
});
