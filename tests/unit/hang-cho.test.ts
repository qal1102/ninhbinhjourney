import { describe, expect, it } from "vitest";
import {
  benCuaCoSo,
  benCuaDiemDen,
  daQuaGioGiu,
  docDanhSachErp,
  docLuotCuaKhach,
  docTongQuan,
  laMaBen,
  soHienThi,
  tocDoLenThuyen,
  uocPhutCho,
} from "@/domain/hang-cho";

const TQ = {
  dang_nhan: true,
  loi_tam_dung: null,
  khach_moi_phut_khai: "5.00",
  phut_giu_luot: 10,
  so_nhom_cho: 4,
  so_khach_cho: 14,
  dang_goi: [2],
  goi_toi_so: 2,
  so_cap: 6,
  khach_len_30_phut: 0,
  da_len_hom_nay: 2,
  nhom_da_len: 1,
  nhom_bo_luot: 0,
  nhom_huy: 1,
  phut_cho_tb: "3.5",
};

describe("hàng chờ bến đò", () => {
  it("chỉ Tam Cốc có hàng chờ, nối đúng trang điểm đến", () => {
    expect(laMaBen("tam-coc")).toBe(true);
    expect(laMaBen("trang-an")).toBe(false);
    expect(laMaBen("__proto__")).toBe(false);
    expect(benCuaCoSo("tam-coc")).toBe("tam-coc");
    expect(benCuaCoSo("trang-an")).toBeNull();
    expect(benCuaDiemDen("tam-coc-bich-dong")).toBe("tam-coc");
    expect(benCuaDiemDen("trang-an")).toBeNull();
  });

  it("đọc số kho trả về, kể cả số dạng chuỗi của numeric", () => {
    const tq = docTongQuan(TQ)!;
    expect(tq.khachMoiPhutKhai).toBe(5);
    expect(tq.phutChoTrungBinh).toBe(3.5);
    expect(tq.dangGoi).toEqual([2]);
    expect(docTongQuan(null)).toBeNull();
  });

  it("giờ chờ dùng tốc độ khai khi chưa đủ khách lên đò để đo", () => {
    expect(tocDoLenThuyen({ khachLen30Phut: 5, khachMoiPhutKhai: 5 })).toEqual({ khachMoiPhut: 5, nguon: "khai" });
    expect(tocDoLenThuyen({ khachLen30Phut: 60, khachMoiPhutKhai: 5 })).toEqual({ khachMoiPhut: 2, nguon: "do" });
    expect(uocPhutCho(0, { khachLen30Phut: 0, khachMoiPhutKhai: 5 })).toBe(0);
    // 9 khách ở 5 khách/phút ≈ 2 phút, làm tròn lên mốc 5.
    expect(uocPhutCho(9, { khachLen30Phut: 0, khachMoiPhutKhai: 5 })).toBe(5);
    // 60 khách ở tốc độ đo 2 khách/phút = 30 phút.
    expect(uocPhutCho(60, { khachLen30Phut: 60, khachMoiPhutKhai: 5 })).toBe(30);
  });

  it("lượt đã gọi quá giờ giữ thì bị đánh dấu", () => {
    const goi = "2026-09-30T08:00:00Z";
    expect(daQuaGioGiu(goi, 10, Date.parse("2026-09-30T08:09:00Z"))).toBe(false);
    expect(daQuaGioGiu(goi, 10, Date.parse("2026-09-30T08:11:00Z"))).toBe(true);
    expect(daQuaGioGiu(null, 10)).toBe(false);
  });

  it("đọc lượt của khách và danh sách ERP, bỏ dòng hỏng", () => {
    const luot = docLuotCuaKhach({ so_thu_tu: 4, so_khach: 5, trang_thai: "cho", tao_luc: "2026-09-30T08:00:00Z", goi_luc: null, nhom_truoc: 3, khach_truoc: 9, tong_quan: TQ });
    expect(luot?.nhomTruoc).toBe(3);
    expect(docLuotCuaKhach({ trang_thai: "la", tao_luc: "x", tong_quan: TQ })).toBeNull();
    const ds = docDanhSachErp({
      tong_quan: TQ,
      luot: [
        { id: "a", so_thu_tu: 1, so_khach: 2, ngon_ngu: "en", trang_thai: "da-goi", tao_luc: "2026-09-30T08:00:00Z", goi_luc: null, xong_luc: null },
        { id: "b", trang_thai: "het-ngay", tao_luc: "2026-09-30T08:00:00Z" },
        "rác",
      ],
    });
    expect(ds?.luot.map((l) => l.id)).toEqual(["a"]);
    expect(ds?.luot[0].ngonNgu).toBe("en");
  });

  it("số hiển thị có ba chữ số", () => {
    expect(soHienThi(7)).toBe("A007");
    expect(soHienThi(1234)).toBe("A1234");
  });
});
