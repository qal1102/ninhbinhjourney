import { describe, expect, it } from "vitest";
import { docSoNoiBat, goiYChoNhom, loaiNhom } from "@/domain/goi-y";
import { docSuKien, hatGiongKhop, tinhNguoiTrung } from "@/domain/su-kien";
import { GIAI_THI_ANH, laDiaDiemThiAnh, thangTruoc, thangVN, tongGiaTriGiai } from "@/domain/thi-anh";

/* Kết quả thật của `erp_su_kien_rut` chạy trên PGlite (migration 127), 4 người, 2 giải. */
const RUT_THAT = {
  slug: "dem-trang-trang-an-2026",
  trang_thai: "da-rut",
  so_giai: 2,
  hat_giong: "b8827b1cb27e636582f12d7d0249f77806486aa5e5944ad739b7e68a1eefccd2",
  hat_giong_bam: "069acc34f9a4bccd9cf533969730cc5f2838731815d079c5e1ed468c3fab2978",
  danh_sach: [
    { ma: "SK-CF597A", so: "•••111", luot: 1, trung: 1 },
    { ma: "SK-3DE217", so: "•••333", luot: 1, trung: 2 },
    { ma: "SK-0E0331", so: "•••222", luot: 1, trung: null },
    { ma: "SK-71529E", so: "•••444", luot: 1, trung: null },
  ],
};

describe("rút thăm minh bạch", () => {
  it("máy khách tính lại đúng người trúng mà kho đã rút", async () => {
    const sk = docSuKien(RUT_THAT)!;
    expect(await hatGiongKhop(sk.hatGiong!, sk.hatGiongBam)).toBe(true);
    expect(await tinhNguoiTrung(sk.hatGiong!, sk.danhSach!, sk.soGiai)).toEqual(["SK-CF597A", "SK-3DE217"]);
  });

  it("đổi một ký tự hạt giống là không khớp mã cam kết", async () => {
    expect(await hatGiongKhop(`${RUT_THAT.hat_giong.slice(0, -1)}0`, RUT_THAT.hat_giong_bam)).toBe(false);
  });

  it("thêm lượt không bao giờ làm điểm tệ đi, và trần là 5 lượt", async () => {
    const it1 = await tinhNguoiTrung("hat", [{ ma: "SK-A", luot: 1 }, { ma: "SK-B", luot: 1 }], 1);
    const thua = it1[0] === "SK-A" ? "SK-B" : "SK-A";
    // Người thua được 5 lượt: hoặc vẫn thua, hoặc thắng; 50 lượt cũng chỉ tính như 5.
    const nam = await tinhNguoiTrung("hat", [{ ma: "SK-A", luot: thua === "SK-A" ? 5 : 1 }, { ma: "SK-B", luot: thua === "SK-B" ? 5 : 1 }], 1);
    const namMuoi = await tinhNguoiTrung("hat", [{ ma: "SK-A", luot: thua === "SK-A" ? 50 : 1 }, { ma: "SK-B", luot: thua === "SK-B" ? 50 : 1 }], 1);
    expect(namMuoi).toEqual(nam);
  });

  it("chưa rút thì không có hạt giống, không có danh sách", () => {
    const sk = docSuKien({ ...RUT_THAT, trang_thai: "mo", hat_giong: null, danh_sach: null })!;
    expect(sk.hatGiong).toBeNull();
    expect(sk.danhSach).toBeNull();
  });
});

describe("thi ảnh tháng", () => {
  it("8 giải, tổng 4.180.000 đ", () => {
    expect(GIAI_THI_ANH.reduce((c, g) => c + g.soLuong, 0)).toBe(8);
    expect(tongGiaTriGiai()).toBe(4_180_000);
  });

  it("tháng theo giờ Việt Nam, lùi tháng qua năm", () => {
    expect(thangVN(new Date("2026-10-31T18:00:00Z"))).toBe("2026-11");
    expect(thangTruoc("2026-01")).toBe("2025-12");
    expect(thangTruoc("2026-10")).toBe("2026-09");
  });

  it("chỉ nhận nơi chụp trong danh sách", () => {
    expect(laDiaDiemThiAnh("hoa-lu")).toBe(true);
    expect(laDiaDiemThiAnh("ha-long")).toBe(false);
  });
});

describe("khách giống bạn hay chọn", () => {
  const so = docSoNoiBat({
    diem: { "trang-an": 2332 },
    goi: { "family-discovery": 40 },
    theo_nhom: {
      "gia-dinh-co-tre": [
        { slug: "family-discovery", don: 180, tong: 430 },
        { slug: "heritage-day", don: 120, tong: 430 },
      ],
      "mot-minh": [{ slug: "heritage-day", don: 3, tong: 5 }],
    },
  });
  const dangBan = new Set(["family-discovery", "heritage-day", "ve-trang-an"]);

  it("kiểu nhóm theo người lớn và trẻ em", () => {
    expect(loaiNhom(2, 1)).toBe("gia-dinh-co-tre");
    expect(loaiNhom(1, 0)).toBe("mot-minh");
    expect(loaiNhom(2, 0)).toBe("hai-nguoi");
    expect(loaiNhom(5, 0)).toBe("nhom-ban");
  });

  it("gợi ý gói nhóm cùng kiểu hay chọn, khác gói đang xem", () => {
    expect(goiYChoNhom(so, "gia-dinh-co-tre", "ve-trang-an", dangBan)).toEqual({ slug: "family-discovery", phanTram: 42 });
    expect(goiYChoNhom(so, "gia-dinh-co-tre", "family-discovery", dangBan)).toBeNull();
  });

  it("ít đơn quá thì không nói", () => {
    expect(goiYChoNhom(so, "mot-minh", "ve-trang-an", dangBan)).toBeNull();
    expect(goiYChoNhom(null, "gia-dinh-co-tre", "ve-trang-an", dangBan)).toBeNull();
  });

  it("gói đã khép mùa không được gợi ý", () => {
    expect(goiYChoNhom(so, "gia-dinh-co-tre", "ve-trang-an", new Set(["ve-trang-an"]))).toBeNull();
  });
});
