import { describe, expect, it } from "vitest";
import { congNgay, type NgayBaoCao } from "@/domain/bao-cao-co-so";
import { cacNgayTrongKy, docKy, phanTramDoi, sucChuaGioNay, tiTrong, tongTheoKy } from "@/domain/toan-vung";

const HOM_NAY = "2026-10-12";

function chuoi(soNgay: number): NgayBaoCao[] {
  // Ngày càng xa hôm nay càng ít khách: hôm nay 1 khách mỗi đơn vị, hôm qua 2…
  return Array.from({ length: soNgay }, (_, i) => ({
    ngay: congNgay(HOM_NAY, -i),
    khachVao: i + 1,
    khachCoVe: 0,
    khachWeb: 1,
    khachWebDaVao: 0,
    tienQuay: (i + 1) * 1000,
    phieuQuay: 1,
    tienWeb: 500,
  }));
}

describe("màn Toàn vùng", () => {
  it("kỳ lạ trong địa chỉ thì về Hôm nay", () => {
    expect(docKy(undefined)).toBe("hom-nay");
    expect(docKy("abc")).toBe("hom-nay");
    expect(docKy("30-ngay")).toBe("30-ngay");
  });

  it("Hôm nay so với hôm qua", () => {
    const { hienTai, truoc } = tongTheoKy(chuoi(60), "hom-nay", HOM_NAY);
    expect(hienTai.khach).toBe(1);
    expect(truoc.khach).toBe(2);
    expect(hienTai.tienQuay + hienTai.tienWeb).toBe(1500);
  });

  it("7 ngày cộng đúng bảy ngày gồm hôm nay, kỳ trước là bảy ngày liền trước", () => {
    const { hienTai, truoc } = tongTheoKy(chuoi(60), "7-ngay", HOM_NAY);
    expect(hienTai.khach).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7);
    expect(truoc.khach).toBe(8 + 9 + 10 + 11 + 12 + 13 + 14);
    expect(hienTai.phieuQuay).toBe(7);
  });

  it("30 ngày thiếu dữ liệu kỳ trước thì phần trăm đổi không bịa ra", () => {
    const { hienTai, truoc } = tongTheoKy(chuoi(30), "30-ngay", HOM_NAY);
    expect(hienTai.khach).toBe((30 * 31) / 2);
    expect(truoc.khach).toBe(0);
    expect(phanTramDoi(hienTai.khach, truoc.khach)).toBeNull();
  });

  it("biểu đồ của kỳ Hôm nay kéo về 14 ngày", () => {
    expect(cacNgayTrongKy(chuoi(60), "hom-nay", HOM_NAY)).toHaveLength(14);
    expect(cacNgayTrongKy(chuoi(60), "30-ngay", HOM_NAY)).toHaveLength(30);
  });

  it("tỉ trọng khi tổng bằng 0 là 0, không phải NaN", () => {
    expect(tiTrong(0, 0)).toBe(0);
    expect(tiTrong(25, 100)).toBe(25);
    expect(phanTramDoi(120, 100)).toBe(20);
  });
});

describe("sức chứa giờ này của một cơ sở", () => {
  const nguong = (ten: string, tran: number) => ({ bottleneckName: ten, effectiveCapacity: tran, watchPercent: 70, restrictPercent: 85, stopPercent: 100 });

  it("chọn điểm nghẽn đầy nhất và đặt mức theo ngưỡng của chính nó", () => {
    const kq = sucChuaGioNay(360, [nguong("Cổng soát vé", 1200), nguong("Bến thuyền", 400)]);
    expect(kq.luot).toBe(360);
    expect(kq.nghen).toEqual({ ten: "Bến thuyền", phanTram: 90, muc: "orange", tranGio: 400 });
  });

  it("chưa đặt ngưỡng, hay trần bằng 0, thì không có điểm nghẽn", () => {
    expect(sucChuaGioNay(50, []).nghen).toBeNull();
    expect(sucChuaGioNay(50, [nguong("Bãi xe", 0)]).nghen).toBeNull();
  });

  it("chưa ai qua cổng thì 0% và mức bình thường", () => {
    expect(sucChuaGioNay(0, [nguong("Bến thuyền", 400)]).nghen).toMatchObject({ phanTram: 0, muc: "green" });
  });
});
