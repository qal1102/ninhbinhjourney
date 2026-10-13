/**
 * Danh sách đoàn trong ERP (13/10/2026, migration 131): đoàn web (trưởng đoàn
 * tạo mã sau khi đặt) và đoàn quầy (bán ở ô Vé đoàn) cùng một bảng, cùng trang
 * trưởng đoàn `/doan/truong/<mã>`. ERP đọc cả hai từ `erp_danh_sach_doan`.
 */

export type DoanErp = {
  groupCode: string;
  nhan: string;
  truongDoan: string;
  /** Ba số cuối, đã che ở kho. */
  soTruongDoan: string | null;
  nguon: "web" | "quay";
  ngayDi: string;
  orderCode: string | null;
  saleCode: string | null;
  daHuy: boolean;
  congTy: string | null;
  giamPhanTram: number | null;
  hoaDon: boolean;
  tienVnd: number | null;
  soNguoi: number;
  ghiTen: number;
  moMa: number;
  chamSoc: number;
  quaCong: number;
  diem: string[];
  ve: string[];
};

function chu(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function so(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function dsChu(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function docDanhSachDoan(raw: unknown): DoanErp[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    const groupCode = chu(r.group_code);
    if (!groupCode) return [];
    return [
      {
        groupCode,
        nhan: chu(r.group_label).trim(),
        truongDoan: chu(r.leader_name),
        soTruongDoan: chu(r.leader_phone) || null,
        nguon: r.nguon === "web" ? "web" : "quay",
        ngayDi: chu(r.ngay_di).slice(0, 10),
        orderCode: chu(r.order_code) || null,
        saleCode: chu(r.sale_code) || null,
        daHuy: r.sale_status === "voided",
        congTy: chu(r.cong_ty) || null,
        giamPhanTram: r.giam_phan_tram === null || r.giam_phan_tram === undefined ? null : so(r.giam_phan_tram),
        hoaDon: r.hoa_don === true,
        tienVnd: r.tien_vnd === null || r.tien_vnd === undefined ? null : so(r.tien_vnd),
        soNguoi: so(r.so_nguoi),
        ghiTen: so(r.ghi_ten),
        moMa: so(r.mo_ma),
        chamSoc: so(r.cham_soc),
        quaCong: so(r.qua_cong),
        diem: dsChu(r.diem),
        ve: dsChu(r.ve),
      },
    ];
  });
}

export type TomTatDoan = { soDoan: number; soNguoi: number; quaCong: number; tuWeb: number; tuQuay: number };

export function tomTatDoan(ds: readonly DoanErp[]): TomTatDoan {
  const conHieuLuc = ds.filter((d) => !d.daHuy);
  return {
    soDoan: conHieuLuc.length,
    soNguoi: conHieuLuc.reduce((t, d) => t + d.soNguoi, 0),
    quaCong: conHieuLuc.reduce((t, d) => t + d.quaCong, 0),
    tuWeb: conHieuLuc.filter((d) => d.nguon === "web").length,
    tuQuay: conHieuLuc.filter((d) => d.nguon === "quay").length,
  };
}
