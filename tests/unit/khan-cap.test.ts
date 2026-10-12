import { describe, expect, it } from "vitest";
import { docBaoDong, duongGoi, giayDaQua, laLoaiKhanCap, nguoiSeGoi, type CapTren } from "@/domain/khan-cap";

/*
 * Báo khẩn cấp (12/10/2026, migration 121). Phần thuần trên máy: ai sẽ được
 * tự gọi khi quá 2 phút, đường gọi sạch, đồng hồ đếm, đọc kết quả kho.
 */

const capTren = (ds: Partial<CapTren>[]): CapTren[] =>
  ds.map((c, i) => ({ accountId: `a${i}`, ten: `Người ${i}`, vai: "director", dienThoai: null, ...c }));

describe("ai được tự gọi khi quá 2 phút", () => {
  it("quản lý cơ sở có số trước giám đốc có số", () => {
    const ds = capTren([{ vai: "director", dienThoai: "0911000001" }, { vai: "manager", dienThoai: "0911000002", ten: "QL" }]);
    expect(nguoiSeGoi(ds)?.ten).toBe("QL");
  });

  it("quản lý chưa ghi số thì gọi giám đốc", () => {
    const ds = capTren([{ vai: "manager", dienThoai: null }, { vai: "director", dienThoai: "0911000001", ten: "GĐ" }]);
    expect(nguoiSeGoi(ds)?.ten).toBe("GĐ");
  });

  it("không ai ghi số thì không gọi ai", () => {
    expect(nguoiSeGoi(capTren([{ vai: "manager" }, { vai: "director" }]))).toBeNull();
  });
});

describe("đường gọi và đồng hồ", () => {
  it("tel: chỉ giữ chữ số và dấu + đầu", () => {
    expect(duongGoi("0912 345.678")).toBe("tel:0912345678");
    expect(duongGoi("+84 (912) 345-678")).toBe("tel:+84912345678");
    expect(duongGoi("115")).toBe("tel:115");
  });

  it("đếm giây từ lúc báo, không âm", () => {
    const bao = "2026-10-12T03:00:00.000Z";
    expect(giayDaQua(bao, Date.parse(bao) + 125_000)).toBe(125);
    expect(giayDaQua(bao, Date.parse(bao) - 5_000)).toBe(0);
  });
});

describe("đọc báo động từ kho", () => {
  it("đọc đủ trường, loại lạ về 'khac'", () => {
    const bd = docBaoDong({
      ma: "KC-ABCD1234",
      site_id: "s",
      site_name: "Tràng An",
      incident_id: "INC-TA-KC1",
      loai: "lạ",
      vi_do: "20.25311",
      kinh_do: 105.91702,
      sai_so_m: 12,
      nguoi_bao_account_id: "employee-trang-an-01",
      nguoi_bao_ten: "Nhân viên A",
      bao_luc: "2026-10-12T03:00:00Z",
      cap_tren: [{ account_id: "manager-trang-an", ten: "QL", vai: "manager", dien_thoai: "0911" }],
    });
    expect(bd).toMatchObject({ ma: "KC-ABCD1234", loai: "khac", viDo: 20.25311, kinhDo: 105.91702, nhanLuc: null });
    expect(bd?.capTren[0]).toEqual({ accountId: "manager-trang-an", ten: "QL", vai: "manager", dienThoai: "0911" });
    expect(laLoaiKhanCap("nguoi-gap-nan")).toBe(true);
  });

  it("không có mã thì không phải báo động", () => {
    expect(docBaoDong({})).toBeNull();
    expect(docBaoDong(null)).toBeNull();
  });
});
