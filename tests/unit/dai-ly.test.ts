import { describe, expect, it } from "vitest";
import {
  cheMaDon,
  chonThang,
  congThang,
  docBangThang,
  docDonGanDay,
  goiYMa,
  laMaDaiLy,
  thangHienTai,
  tien,
  trangThaiDon,
} from "@/domain/dai-ly";

describe("đại lý & hoa hồng", () => {
  it("mã đại lý: 4–16 chữ in hoa hoặc số", () => {
    expect(laMaDaiLy("HONGHA")).toBe(true);
    expect(laMaDaiLy("abc")).toBe(false);
    expect(laMaDaiLy("HONG-HA")).toBe(false);
    expect(goiYMa("Công ty TNHH Du lịch Đồng Xanh")).toBe("DONGXANH");
    expect(laMaDaiLy(goiYMa("Ạ"))).toBe(true);
  });

  it("tháng theo giờ Việt Nam, không nhận tháng tương lai hay quá cũ", () => {
    // 30/09 lúc 18:00 UTC đã là 01/10 ở Việt Nam.
    const bayGio = new Date("2026-09-30T18:00:00Z");
    expect(thangHienTai(bayGio)).toBe("2026-10");
    expect(congThang("2026-01", -1)).toBe("2025-12");
    expect(chonThang("2026-09", bayGio)).toBe("2026-09");
    expect(chonThang("2026-11", bayGio)).toBe("2026-10");
    expect(chonThang("2020-01", bayGio)).toBe("2026-10");
    expect(chonThang("rác", bayGio)).toBe("2026-10");
  });

  it("đọc bảng tháng kho trả về, số dạng chuỗi của numeric", () => {
    const [d] = docBangThang([
      { id: "a", ma: "HONGHA", ten: "Hồng Hà", ty_le: "8.00", trang_thai: "hop-tac", la_mau: true, co_khoa: false, don: 17, khach: 34, doanh_thu: 8500000, don_toi: 6, khach_toi: 12, doanh_thu_toi: 3000000, hoa_hong: "240000", da_chi: null },
      { ma: "HONG" },
    ]);
    expect(d.tyLe).toBe(8);
    expect(d.hoaHong).toBe(240000);
    expect(d.daChi).toBeNull();
    expect(docBangThang(null)).toEqual([]);
  });

  it("cổng đại lý che mã đơn và gọi tên tình trạng", () => {
    expect(cheMaDon("NBJ-ABCDEFGHIJKL")).toBe("NBJ-ABCD••••••••");
    const [don] = docDonGanDay([{ order_code: "NBJ-ABCDEFGHIJKL", visit_date: "2026-09-20", party_size: 2, total_vnd: 500000, status: "confirmed", da_toi: false }]);
    expect(trangThaiDon(don)).toBe("Đã trả, chờ khách tới");
    expect(trangThaiDon({ ...don, daToi: true })).toBe("Khách đã tới");
    expect(tien(240000)).toMatch(/^240\.000 đ$/);
  });
});
