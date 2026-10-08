import { describe, expect, it } from "vitest";
import type { SupplierApSupplier } from "@/domain/erp-supplier-ap";
import { dienHoaDonNcc, doiChieuBo, kiemGiayTo, type TrichXuat } from "@/domain/soat-giay-to";

const ncc: SupplierApSupplier[] = [
  { id: "ncc-1", siteId: "trang-an", code: "NCC-TA-018", name: "Công ty Dịch vụ Tràng An Xanh", taxCode: "2700123456", paymentTermsDays: 30, status: "active" },
];

const trong: TrichXuat = {
  loai: "khac",
  docRo: true,
  soChungTu: null,
  kyHieu: null,
  ngay: null,
  maCqt: null,
  tenBenBan: null,
  mstBenBan: null,
  tenBenMua: null,
  mstBenMua: null,
  noiDung: null,
  tienTruocThue: null,
  thueSuat: null,
  tienThue: null,
  tongTien: null,
  canCu: null,
  coChuKyBenBan: null,
  coChuKySoBenBan: null,
  coDauBenBan: null,
  coChuKyBenMua: null,
  coDauBenMua: null,
  soNguoi: null,
  danhSachTen: [],
  ghiChu: "",
};

// Đúng những gì Gemini đọc từ `public/images/erp/giay-to-mau/*.jpg` ngày 08/10/2026.
const hoaDonLoi: TrichXuat = {
  ...trong,
  loai: "hoa-don",
  soChungTu: "00000131",
  kyHieu: "1C26TAX",
  ngay: "2026-11-15",
  tenBenBan: "CÔNG TY DỊCH VỤ TRÀNG AN XANH",
  mstBenBan: "2700123456",
  tenBenMua: "CÔNG TY DU LỊCH NINH BÌNH JOURNEY (BẢN THỬ)",
  noiDung: "Sửa chữa máy bơm nước khu bến",
  tienTruocThue: 8_500_000,
  thueSuat: 10,
  tienThue: 850_000,
  tongTien: 9_530_000,
  coChuKyBenBan: false,
  coChuKySoBenBan: false,
};

const hoaDonDu: TrichXuat = {
  ...hoaDonLoi,
  soChungTu: "00000128",
  ngay: "2026-10-05",
  maCqt: "00F1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6",
  mstBenMua: "2700000018",
  noiDung: "Dịch vụ vệ sinh khu bến thuyền tháng 9/2026",
  tienTruocThue: 12_000_000,
  thueSuat: 8,
  tienThue: 960_000,
  tongTien: 12_960_000,
  coChuKySoBenBan: true,
};

const nghiemThu: TrichXuat = {
  ...trong,
  loai: "nghiem-thu",
  soChungTu: "09/2026/NT-TAX",
  ngay: "2026-09-30",
  tenBenBan: "CÔNG TY DỊCH VỤ TRÀNG AN XANH",
  mstBenBan: "2700123456",
  tenBenMua: "CÔNG TY DU LỊCH NINH BÌNH JOURNEY (BẢN THỬ)",
  mstBenMua: "2700000018",
  noiDung: "Vệ sinh khu bến thuyền; thu gom rác dọc tuyến 1",
  tienTruocThue: 12_000_000,
  canCu: "hợp đồng số 03/2026/HĐDV-TAX ngày 02/01/2026",
  coChuKyBenBan: true,
  coDauBenBan: true,
  coChuKyBenMua: false,
};

const trangThai = (muc: { ten: string; trangThai: string }[], ten: string) => muc.find((m) => m.ten === ten)?.trangThai;

describe("soát từng giấy tờ", () => {
  it("hoá đơn lỗi báo đủ bốn chỗ hỏng", () => {
    const kq = kiemGiayTo(hoaDonLoi, "2026-10-08", ncc);
    expect(kq.ketLuan).toBe("thieu");
    expect(trangThai(kq.muc, "MST người mua")).toBe("thieu");
    expect(trangThai(kq.muc, "Cộng tiền")).toBe("sai");
    expect(trangThai(kq.muc, "Chữ ký người bán")).toBe("thieu");
    expect(trangThai(kq.muc, "Ngày lập")).toBe("sai");
    expect(trangThai(kq.muc, "Mã của cơ quan thuế")).toBe("can-xem");
  });

  it("hoá đơn đủ thì đạt và nhận ra nhà cung cấp trong danh mục", () => {
    const kq = kiemGiayTo(hoaDonDu, "2026-10-08", ncc);
    expect(kq.ketLuan).toBe("dat");
    expect(kq.muc.find((m) => m.ten === "Nhà cung cấp trong danh mục")?.chiTiet).toContain("NCC-TA-018");
  });

  it("biên bản nghiệm thu thiếu chữ ký bên nhận", () => {
    const kq = kiemGiayTo(nghiemThu, "2026-10-08", ncc);
    expect(kq.ketLuan).toBe("thieu");
    expect(trangThai(kq.muc, "Chữ ký bên nhận")).toBe("thieu");
    expect(trangThai(kq.muc, "Chữ ký bên cung cấp")).toBe("dat");
  });

  it("MST sai dạng bị báo sai", () => {
    const kq = kiemGiayTo({ ...hoaDonDu, mstBenBan: "27001234" }, "2026-10-08", ncc);
    expect(trangThai(kq.muc, "MST người bán")).toBe("sai");
  });
});

describe("đối chiếu cả bộ và điền hồ sơ", () => {
  it("nghiệm thu khớp hoá đơn đủ, lệch với hoá đơn lỗi", () => {
    const khop = doiChieuBo([hoaDonDu, nghiemThu]);
    expect(trangThai(khop, "Cùng một nhà cung cấp")).toBe("dat");
    expect(trangThai(khop, "Nghiệm thu khớp hoá đơn")).toBe("dat");
    expect(trangThai(khop, "Thứ tự ngày")).toBe("dat");
    expect(trangThai(doiChieuBo([hoaDonLoi, nghiemThu]), "Nghiệm thu khớp hoá đơn")).toBe("sai");
  });

  it("điền đúng nhà cung cấp, số hoá đơn, tiền và số nghiệm thu", () => {
    const { siteId, dien } = dienHoaDonNcc([hoaDonDu, nghiemThu], ncc);
    expect(siteId).toBe("trang-an");
    expect(dien).toMatchObject({
      supplierId: "ncc-1",
      invoiceSeries: "1C26TAX",
      invoiceNumber: "00000128",
      invoiceDate: "2026-10-05",
      netVnd: 12_000_000,
      vatVnd: 960_000,
      totalVnd: 12_960_000,
      acceptanceReference: "09/2026/NT-TAX",
      acceptedTotalVnd: 12_000_000,
      contractReference: "03/2026/HĐDV-TAX",
    });
  });
});
