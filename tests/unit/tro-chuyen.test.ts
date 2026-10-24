import { describe, expect, it } from "vitest";
import { danhMucGan, duongDanThe, kiemTep, kiemTheGan, tenPhong } from "@/domain/tro-chuyen";

const PHONG = "11111111-1111-4111-8111-111111111111";
const ctx = { coSoMau: "trang-an", vanBan: new Set(["VB-MAU014"]) };

describe("thẻ gắn trong tin", () => {
  it("nhận chức năng có trong bản đồ, lấy tên và đường dẫn từ bản đồ chứ không từ trình duyệt", () => {
    const kq = kiemTheGan([{ kieu: "chuc-nang", id: "ban-quay", ten: "tên giả", duongDan: "https://lua-dao.example" }], ctx);
    expect(kq).toHaveLength(1);
    expect(kq?.[0].ten).not.toBe("tên giả");
    expect(kq?.[0].duongDan).toBe("/erp/trang-an/ve-dat-cho");
  });

  it("từ chối chức năng không có thật, văn bản chưa nhận, quá 4 thẻ", () => {
    expect(kiemTheGan([{ kieu: "chuc-nang", id: "khong-co" }], ctx)).toBeNull();
    expect(kiemTheGan([{ kieu: "van-ban", id: "VB-XXXXXX", ten: "x" }], ctx)).toBeNull();
    expect(kiemTheGan(Array(5).fill({ kieu: "chuc-nang", id: "ban-quay" }), ctx)).toBeNull();
    expect(kiemTheGan([{ kieu: "lien-ket", id: "x" }], ctx)).toBeNull();
  });

  it("văn bản đã nhận thì gắn được, mở bằng mã", () => {
    const kq = kiemTheGan([{ kieu: "van-ban", id: "VB-MAU014", ten: "HĐ-NCC-2026-0014" }], ctx);
    expect(kq && duongDanThe(kq[0])).toBe("/erp/van-ban?ma=VB-MAU014");
  });

  it("chức năng ERP mở kèm ?chi= để khoanh đúng chỗ", () => {
    const m = danhMucGan("tam-coc").find((x) => x.id === "ban-quay")!;
    expect(duongDanThe({ kieu: "chuc-nang", id: m.id, ten: m.ten, duongDan: m.duongDan })).toBe("/erp/tam-coc/ve-dat-cho?chi=ban-quay");
  });

  it("danh mục có cả chức năng ERP lẫn trang của khách, không trùng khoá", () => {
    const ds = danhMucGan("trang-an");
    expect(ds.some((m) => m.kieu === "trang-khach")).toBe(true);
    expect(new Set(ds.map((m) => `${m.kieu}:${m.id}`)).size).toBe(ds.length);
  });
});

describe("tệp đính kèm", () => {
  const tep = (path: string, kieu = "image/jpeg") => ({ path, ten: "a.jpg", co: 1000, kieu });
  it("chỉ nhận tệp nằm trong thư mục của đúng phòng, kiểu cho phép", () => {
    expect(kiemTep([tep(`tc/${PHONG}/22222222-2222-4222-8222-222222222222.jpg`)], PHONG)).toHaveLength(1);
    expect(kiemTep([tep(`tc/33333333-3333-4333-8333-333333333333/22222222-2222-4222-8222-222222222222.jpg`)], PHONG)).toBeNull();
    expect(kiemTep([tep(`tc/${PHONG}/../khac.jpg`)], PHONG)).toBeNull();
    expect(kiemTep([tep(`tc/${PHONG}/22222222-2222-4222-8222-222222222222.exe`, "application/x-msdownload")], PHONG)).toBeNull();
  });
});

describe("tên phòng", () => {
  it("phòng riêng lấy tên người kia, nhóm lấy tên nhóm", () => {
    const tv = [
      { id: "a", ten: "Giám đốc", docDen: "" },
      { id: "b", ten: "Quản lý Tràng An", docDen: "" },
    ];
    expect(tenPhong({ loai: "rieng", ten: null, thanhVien: tv }, "a")).toBe("Quản lý Tràng An");
    expect(tenPhong({ loai: "nhom", ten: "Điều hành", thanhVien: tv }, "a")).toBe("Điều hành");
  });
});
