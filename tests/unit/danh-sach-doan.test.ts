import { describe, expect, it } from "vitest";
import { docDanhSachDoan, tomTatDoan } from "@/domain/danh-sach-doan";

const WEB = {
  group_code: "DOAN-964726B846",
  group_label: "Đoàn thử web",
  leader_name: "Lê Thị Hướng Dẫn",
  leader_phone: "•••678",
  nguon: "web",
  ngay_di: "2026-10-15",
  order_code: "NBJ-AAAAAAAAAAAA",
  sale_code: null,
  sale_status: null,
  cong_ty: null,
  giam_phan_tram: null,
  hoa_don: false,
  tien_vnd: 500000,
  so_nguoi: 2,
  ghi_ten: 1,
  mo_ma: 1,
  cham_soc: 0,
  qua_cong: 0,
  diem: ["Tràng An"],
  ve: ["WEB-44BAF1F8DE90"],
};

describe("danh sách đoàn ERP", () => {
  it("đọc đoàn web và đoàn quầy", () => {
    const ds = docDanhSachDoan([
      WEB,
      { ...WEB, group_code: "DOAN-9AFD1D3C8E", nguon: "quay", order_code: null, sale_code: "PT-C48AFBE70330", sale_status: "completed", cong_ty: "ABC Travel", giam_phan_tram: 5, hoa_don: true, tien_vnd: 2400000, so_nguoi: 12, qua_cong: 12 },
    ]);
    expect(ds).toHaveLength(2);
    expect(ds[0]).toMatchObject({ nguon: "web", orderCode: "NBJ-AAAAAAAAAAAA", soTruongDoan: "•••678", diem: ["Tràng An"] });
    expect(ds[1]).toMatchObject({ nguon: "quay", saleCode: "PT-C48AFBE70330", congTy: "ABC Travel", hoaDon: true, daHuy: false });
    expect(tomTatDoan(ds)).toEqual({ soDoan: 2, soNguoi: 14, quaCong: 12, tuWeb: 1, tuQuay: 1 });
  });

  it("đoàn quầy đã huỷ phiếu không cộng vào tóm tắt", () => {
    const ds = docDanhSachDoan([{ ...WEB, nguon: "quay", sale_status: "voided" }]);
    expect(ds[0].daHuy).toBe(true);
    expect(tomTatDoan(ds).soDoan).toBe(0);
  });

  it("bỏ dòng hỏng, dữ liệu không phải mảng thì rỗng", () => {
    expect(docDanhSachDoan(null)).toEqual([]);
    expect(docDanhSachDoan([null, { group_code: "" }, 3])).toEqual([]);
  });
});
