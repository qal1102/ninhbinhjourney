import { describe, expect, it } from "vitest";
import { bangCongCoSo } from "@/domain/erp-shift-presence";

const nguoi = (accountId: string, siteIds: ("trang-an" | "tam-coc")[] = ["trang-an"]) => ({
  accountId,
  displayName: `Người ${accountId}`,
  jobTitle: "Nhân viên",
  siteIds,
  active: true,
});
const luot = (userId: string, type: "check-in" | "check-out", iso: string, siteId: "trang-an" | "tam-coc" = "trang-an") => ({
  userId,
  siteId,
  type,
  createdAt: iso,
  source: "demo-location" as const,
});

describe("bảng công cơ sở", () => {
  const at = new Date("2026-10-06T05:00:00Z"); // 12:00 giờ Việt Nam

  it("bảy cột ngày theo giờ Việt Nam, ô ghi giờ vào và giờ ra", () => {
    const { ngay, dong } = bangCongCoSo({
      directory: [nguoi("a")],
      events: [
        // 05/10: 07:12 vào, 17:20 ra (giờ Việt Nam)
        luot("a", "check-in", "2026-10-05T00:12:00Z"),
        luot("a", "check-out", "2026-10-05T10:20:00Z"),
        // 06/10: 07:41 vào, chưa ra
        luot("a", "check-in", "2026-10-06T00:41:00Z"),
      ],
      siteId: "trang-an",
      at,
    });
    expect(ngay).toHaveLength(7);
    expect(ngay[0]).toBe("2026-09-30");
    expect(ngay[6]).toBe("2026-10-06");
    expect(dong[0].theoNgay["2026-10-05"]).toMatchObject({ vao: "07:12", ra: "17:20", muon: false, dangTrongCa: false });
    expect(dong[0].theoNgay["2026-10-06"]).toMatchObject({ vao: "07:41", ra: null, muon: true, dangTrongCa: true });
    expect(dong[0].theoNgay["2026-10-04"]).toBeNull();
    expect(dong[0].soNgayLam).toBe(2);
    expect(dong[0].soLanMuon).toBe(1);
    expect(dong[0].gioVaoTrungBinh).toBe("07:27");
  });

  it("chỉ tính người và lượt của đúng cơ sở", () => {
    const { dong } = bangCongCoSo({
      directory: [nguoi("a"), nguoi("b", ["tam-coc"])],
      events: [luot("a", "check-in", "2026-10-06T00:10:00Z", "tam-coc")],
      siteId: "trang-an",
      at,
    });
    expect(dong.map((d) => d.accountId)).toEqual(["a"]);
    expect(dong[0].soNgayLam).toBe(0);
  });
});
