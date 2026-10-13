import { describe, expect, it } from "vitest";
import { docKhachThichGi, goiYTuSo, heSoCuoiTuan, soHienThi } from "@/domain/khach-thich-gi";

/* Số giống kết quả `erp_khach_thich_gi` trên dữ liệu mẫu 60 ngày (migration 126). */
const MAU = {
  tu: "2026-08-15",
  den: "2026-10-13",
  so_ngay: 60,
  nhom_khach: [
    { kenh: "quay", loai: "gia-dinh-co-tre", luot: 5901, khach: 20000 },
    { kenh: "quay", loai: "mot-minh", luot: 3413, khach: 3413 },
    { kenh: "quay", loai: "hai-nguoi", luot: 4901, khach: 9802 },
    { kenh: "quay", loai: "nhom-ban", luot: 5397, khach: 20000 },
    { kenh: "web", loai: "gia-dinh-co-tre", luot: 433, khach: 1900 },
    { kenh: "web", loai: "hai-nguoi", luot: 304, khach: 608 },
    { kenh: "web", loai: "mot-minh", luot: 3, khach: 3 },
  ],
  khach: { nguoi_lon: 52000, tre_em: 8400, luot_mua: 20352, luot_web: 740 },
  goi: [{ slug: "heritage-day", ten: "Di sản trong một ngày", don: 413, khach: 1034, tre_em: 77, tien: 851730000 }],
  dat_truoc: { "trong-ngay": 100, "1-3-ngay": 400, "4-7-ngay": 150, "tren-7-ngay": 90 },
  gio: [
    { site_id: "ta", ten: "Tràng An", tong: 19227, theo_gio: { "7": 531, "8": 2535, "9": 3384, "10": 2799, "12": 1209, "16": 1290, "17": 312 } },
  ],
  thu: { "1": 7724, "2": 7353, "3": 7433, "4": 6381, "5": 7787, "6": 10671, "7": 12013 },
  quay_lai: { ho_so: 900, tu_hai_don: 40 },
  kenh: { dai_ly: 0, ma_moi: 0, web: 740 },
};

describe("khách thích gì", () => {
  it("gộp hai kênh theo loại nhóm, tính phần trăm trên tổng lượt mua", () => {
    const d = docKhachThichGi(MAU);
    const giaDinh = d.nhom.find((n) => n.loai === "gia-dinh-co-tre")!;
    expect(giaDinh.luot).toBe(6334);
    expect(giaDinh.phanTram).toBe(31);
    expect(d.nhom.find((n) => n.loai === "mot-minh")!.luot).toBe(3416);
  });

  it("giờ đông và vắng chỉ xét 7–16 giờ", () => {
    const d = docKhachThichGi(MAU);
    expect(d.gio[0].gioDong).toBe(9);
    expect(d.gio[0].gioVang).toBe(7);
  });

  it("cuối tuần gấp bao nhiêu ngày thường", () => {
    expect(heSoCuoiTuan(docKhachThichGi(MAU).thu)).toBe(1.5);
    expect(heSoCuoiTuan({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 10, 7: 10 })).toBeNull();
  });

  it("mỗi gợi ý dựa trên một con số đủ lớn", () => {
    const goiY = goiYTuSo(docKhachThichGi(MAU));
    const tieuDe = goiY.map((g) => g.tieuDe);
    expect(tieuDe).toContain("31% lượt mua có trẻ em");
    expect(tieuDe.some((t) => t.startsWith("Tràng An lúc 9 giờ đông gấp"))).toBe(true);
    expect(tieuDe).toContain("Thứ Bảy, Chủ nhật đông gấp 1,5 lần ngày thường");
    expect(tieuDe).toContain("68% đơn web đặt trước dưới 4 ngày");
    expect(tieuDe).toContain("Chỉ 4% khách web đặt từ hai lần");
    expect(tieuDe).toContain("Gần như chưa có đơn nào qua đại lý hay mã mời");
  });

  it("kho trống thì không bịa gợi ý", () => {
    expect(goiYTuSo(docKhachThichGi({}))).toEqual([]);
  });

  it("nhóm dưới 5 lượt không ghi số", () => {
    expect(soHienThi(4)).toBe("dưới 5");
    expect(soHienThi(1234)).toBe("1.234");
  });
});
