import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import type { KieuBanThu, LoaiVanBan, NhanXetAi, PhatHien, VanBanDaCo } from "@/domain/van-ban";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * Kho văn bản (migration 132): sổ phát hành và sổ nộp.
 *
 * Production đi thẳng các hàm SQL; ở máy không có kho thì giữ trong bộ nhớ
 * máy chủ, có sẵn sáu văn bản mẫu như migration gieo, để cổng vẫn có cái mà
 * đối chiếu khi chạy thử.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const KHO_TEP = "erp-van-ban";

const SLUG_THEO_UUID = new Map<string, ErpSiteId>(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [uuid, slug as ErpSiteId]),
);

export class VanBanLoi extends Error {}

function khachKho(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-van-ban" } },
  });
}

export function luuTruVanBan(): "supabase" | "memory" {
  return khachKho() ? "supabase" : "memory";
}

/** Câu tiếng Việt của mã lỗi, lấy từ bảng chung `rpc-error-messages` (một nguồn). */
function cau(ma: string) {
  return findRpcBusinessMessage({ message: ma }) ?? "Chưa làm được. Xin thử lại.";
}

function loiKho(error: { code?: string; message?: string }): never {
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42P01") {
    throw new VanBanLoi("Kho chưa có phần văn bản. Xin báo người quản trị hệ thống.");
  }
  const cau = findRpcBusinessMessage(error);
  if (cau) throw new VanBanLoi(cau);
  console.error("Van ban store failed", error);
  throw new VanBanLoi("Kho văn bản chưa trả lời. Xin thử lại.");
}

// ---------- Kiểu ----------

export type PhatHanh = {
  id: string;
  loai: LoaiVanBan;
  phienBan: number;
  soVanBan: string;
  coSo: ErpSiteId | null;
  heThong: Record<string, string>;
  kieu: KieuBanThu;
  maBamNoiDung: string | null;
  phatHanhBoi: string;
  phatHanhTen: string;
  phatHanhLuc: string;
  laMau: boolean;
  daNop: { ketQua: "nhan" | "cho-duyet"; nopLuc: string; nopTen: string } | null;
};

export type BanNop = {
  id: string;
  phatHanhId: string | null;
  loai: LoaiVanBan | null;
  soVanBan: string | null;
  coSo: ErpSiteId | null;
  ketQua: "nhan" | "cho-duyet" | "tra-lai";
  lyDo: string;
  giaTri: Record<string, string>;
  phatHien: PhatHien[];
  ai: NhanXetAi | null;
  tenTep: string | null;
  coTep: boolean;
  apDung: string | null;
  nopBoi: string;
  nopTen: string;
  nopLuc: string;
  duyetTen: string | null;
  duyetLuc: string | null;
  duyetGhiChu: string | null;
  laMau: boolean;
};

export type PhatHanhGan = { id: string; loai: LoaiVanBan; soVanBan: string; kieu: KieuBanThu; phatHanhTen: string; phatHanhLuc: string; daNop: boolean };

export type DanhSachVanBan = { nop: BanNop[]; soPhatHanh: number; phatHanhGan: PhatHanhGan[] };

function chuoiHoa(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, typeof x === "string" ? x : String(x ?? "")]));
}

function docPhatHanh(row: unknown): PhatHanh | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const daNop = r.da_nop && typeof r.da_nop === "object" ? (r.da_nop as Record<string, unknown>) : null;
  return {
    id: r.id,
    loai: r.loai as LoaiVanBan,
    phienBan: Number(r.phien_ban ?? 1),
    soVanBan: String(r.so_van_ban ?? ""),
    coSo: typeof r.site_id === "string" ? (SLUG_THEO_UUID.get(r.site_id) ?? null) : null,
    heThong: chuoiHoa(r.he_thong),
    kieu: (r.kieu as KieuBanThu) ?? "trong",
    maBamNoiDung: typeof r.ma_bam_noi_dung === "string" ? r.ma_bam_noi_dung : null,
    phatHanhBoi: String(r.phat_hanh_boi ?? ""),
    phatHanhTen: String(r.phat_hanh_ten ?? ""),
    phatHanhLuc: typeof r.phat_hanh_luc === "string" ? new Date(r.phat_hanh_luc).toISOString() : new Date().toISOString(),
    laMau: r.la_mau === true,
    daNop: daNop
      ? { ketQua: daNop.ket_qua === "nhan" ? "nhan" : "cho-duyet", nopLuc: String(daNop.nop_luc ?? ""), nopTen: String(daNop.nop_ten ?? "") }
      : null,
  };
}

function docNop(row: unknown): BanNop | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  return {
    id: r.id,
    phatHanhId: typeof r.phat_hanh_id === "string" ? r.phat_hanh_id : null,
    loai: typeof r.loai === "string" ? (r.loai as LoaiVanBan) : null,
    soVanBan: typeof r.so_van_ban === "string" ? r.so_van_ban : null,
    coSo: typeof r.site_id === "string" ? (SLUG_THEO_UUID.get(r.site_id) ?? null) : null,
    ketQua: r.ket_qua === "nhan" || r.ket_qua === "cho-duyet" ? r.ket_qua : "tra-lai",
    lyDo: String(r.ly_do ?? ""),
    giaTri: chuoiHoa(r.gia_tri),
    phatHien: Array.isArray(r.phat_hien) ? (r.phat_hien as PhatHien[]) : [],
    ai: r.ai_nhan_xet && typeof r.ai_nhan_xet === "object" ? (r.ai_nhan_xet as NhanXetAi) : null,
    tenTep: typeof r.ten_tep === "string" ? r.ten_tep : null,
    coTep: r.co_tep === true,
    apDung: typeof r.ap_dung === "string" ? r.ap_dung : null,
    nopBoi: String(r.nop_boi ?? ""),
    nopTen: String(r.nop_ten ?? ""),
    nopLuc: typeof r.nop_luc === "string" ? new Date(r.nop_luc).toISOString() : new Date().toISOString(),
    duyetTen: typeof r.duyet_ten === "string" ? r.duyet_ten : null,
    duyetLuc: typeof r.duyet_luc === "string" ? new Date(r.duyet_luc).toISOString() : null,
    duyetGhiChu: typeof r.duyet_ghi_chu === "string" ? r.duyet_ghi_chu : null,
    laMau: r.la_mau === true,
  };
}

// ---------- Kho tạm khi chạy ở máy ----------

type KhoTam = { phatHanh: Map<string, PhatHanh>; nop: BanNop[]; tep: Map<string, Uint8Array> };

function mauNop(id: string, loai: LoaiVanBan, so: string, coSo: ErpSiteId, giaTri: Record<string, string>, luc: string): [PhatHanh, BanNop] {
  const ph: PhatHanh = {
    id,
    loai,
    phienBan: 1,
    soVanBan: so,
    coSo,
    heThong: { so_van_ban: so, co_so: coSo === "trang-an" ? "Tràng An" : "Tam Cốc" },
    kieu: "dien-dung",
    maBamNoiDung: null,
    phatHanhBoi: "director-001",
    phatHanhTen: "Dữ liệu mẫu",
    phatHanhLuc: luc,
    laMau: true,
    daNop: { ketQua: "nhan", nopLuc: luc, nopTen: "Dữ liệu mẫu" },
  };
  const nop: BanNop = {
    id: randomUUID(),
    phatHanhId: id,
    loai,
    soVanBan: so,
    coSo,
    ketQua: "nhan",
    lyDo: "",
    giaTri: { ...ph.heThong, ...giaTri },
    phatHien: [{ muc: "chung", mucDo: "dat", noi: "Văn bản mẫu, nhận vào hệ thống khi dựng dữ liệu thử.", nguon: "luat" }],
    ai: null,
    tenTep: null,
    coTep: false,
    apDung: "Văn bản mẫu.",
    nopBoi: "director-001",
    nopTen: "Dữ liệu mẫu",
    nopLuc: luc,
    duyetTen: "Dữ liệu mẫu",
    duyetLuc: luc,
    duyetGhiChu: null,
    laMau: true,
  };
  return [ph, nop];
}

function khoTam(): KhoTam {
  const g = globalThis as { __nbjVanBan?: KhoTam };
  if (g.__nbjVanBan) return g.__nbjVanBan;
  const hd = "HĐ-NCC-2026-0014";
  const ncc = { can_cu_hop_dong: hd, ten_ncc: "Công ty Dịch vụ Tràng An Xanh", mst_ncc: "2700123456", dai_dien_a: "Nguyễn Thị Thu Trang", dai_dien_b: "Bùi Thị Hạnh", ket_luan: "Đạt" };
  const mau = [
    mauNop("VB-MAU014", "hop-dong-nha-cung-cap", hd, "trang-an", {
      ten_ncc: "Công ty Dịch vụ Tràng An Xanh", mst_ncc: "2700123456", dia_chi_ncc: "Số 18 đường Tràng An, phường Hoa Lư, tỉnh Ninh Bình",
      nguoi_dai_dien: "Bùi Thị Hạnh", noi_dung: "Thu gom rác trên sông và vệ sinh bến thuyền Tràng An, hai lượt mỗi ngày",
      gia_tri: "180.000.000", thue_suat: "8", tu_ngay: "01/03/2026", den_ngay: "31/12/2026", ngay_ky: "26/02/2026",
    }, "2026-02-26T02:00:00.000Z"),
    mauNop("VB-MAU021", "hop-dong-nha-cung-cap", "HĐ-NCC-2026-0021", "tam-coc", {
      ten_ncc: "Hợp tác xã Dịch vụ Tam Cốc", mst_ncc: "2700765432", dia_chi_ncc: "Thôn Văn Lâm, xã Ninh Hải, tỉnh Ninh Bình",
      nguoi_dai_dien: "Phạm Văn Thành", noi_dung: "Cho thuê 40 áo phao và bảo dưỡng áo phao hằng tháng ở bến Văn Lâm",
      gia_tri: "54.000.000", thue_suat: "8", tu_ngay: "15/04/2026", den_ngay: "14/04/2027", ngay_ky: "10/04/2026",
    }, "2026-04-10T02:00:00.000Z"),
    mauNop("VB-MAU031", "bien-ban-nghiem-thu", "BB-NT-2026-0031", "trang-an", {
      ...ncc, noi_dung: "Thu gom rác trên sông, vệ sinh bến thuyền tháng 3 đến tháng 6", gia_tri: "60.000.000", ngay_nghiem_thu: "30/06/2026",
    }, "2026-06-30T08:00:00.000Z"),
    mauNop("VB-MAU038", "bien-ban-nghiem-thu", "BB-NT-2026-0038", "trang-an", {
      ...ncc, noi_dung: "Thu gom rác trên sông, vệ sinh bến thuyền tháng 7 đến tháng 9", gia_tri: "45.000.000", ngay_nghiem_thu: "30/09/2026",
    }, "2026-09-30T08:00:00.000Z"),
    mauNop("VB-MAU007", "hop-dong-nguoi-cheo", "HĐ-NC-2026-0007", "trang-an", {
      so_thuyen: "03", ho_ten: "Bùi Văn Thắng", ngay_sinh: "02/09/1979", so_cccd: "037079004321", dia_chi: "Thôn Văn Lâm, xã Ninh Hải, tỉnh Ninh Bình",
      loai_hop_dong: "Dài hạn", tu_ngay: "01/01/2026", den_ngay: "", tien_cong: "200.000", ngay_ky: "28/12/2025",
    }, "2025-12-28T02:00:00.000Z"),
    mauNop("VB-MAU009", "hop-dong-nguoi-cheo", "HĐ-NC-2026-0009", "tam-coc", {
      so_thuyen: "05", ho_ten: "Vũ Thị Hương", ngay_sinh: "11/05/1990", so_cccd: "037190005512", dia_chi: "Thôn Văn Lâm, xã Ninh Hải, tỉnh Ninh Bình",
      loai_hop_dong: "Thời vụ", tu_ngay: "01/05/2026", den_ngay: "31/10/2026", tien_cong: "170.000", ngay_ky: "28/04/2026",
    }, "2026-04-28T02:00:00.000Z"),
  ];
  g.__nbjVanBan = { phatHanh: new Map(mau.map(([p]) => [p.id, p])), nop: mau.map(([, n]) => n), tep: new Map() };
  return g.__nbjVanBan;
}

// ---------- Phát hành ----------

export async function giuSoPhatHanh(input: {
  id: string;
  loai: LoaiVanBan;
  phienBan: number;
  tienTo: string;
  coSo: ErpSiteId | null;
  heThong: Record<string, string>;
  kieu: KieuBanThu;
  nguoi: { id: string; ten: string };
}): Promise<{ soVanBan: string; phatHanhLuc: string }> {
  const kho = khachKho();
  if (!kho) {
    const k = khoTam();
    const nam = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 4);
    const tienTo = `${input.tienTo}-${nam}-`;
    const lon = [...k.phatHanh.values()].filter((p) => p.soVanBan.startsWith(tienTo)).reduce((m, p) => Math.max(m, Number(p.soVanBan.slice(-4))), 0);
    const soVanBan = `${tienTo}${String(lon + 1).padStart(4, "0")}`;
    const phatHanhLuc = new Date().toISOString();
    k.phatHanh.set(input.id, {
      id: input.id,
      loai: input.loai,
      phienBan: input.phienBan,
      soVanBan,
      coSo: input.coSo,
      heThong: { ...input.heThong, so_van_ban: soVanBan },
      kieu: input.kieu,
      maBamNoiDung: null,
      phatHanhBoi: input.nguoi.id,
      phatHanhTen: input.nguoi.ten,
      phatHanhLuc,
      laMau: input.kieu !== "trong",
      daNop: null,
    });
    return { soVanBan, phatHanhLuc };
  }
  const { data, error } = await kho.rpc("erp_van_ban_phat_hanh_tao", {
    p_tenant_id: TENANT_ID,
    p_id: input.id,
    p_loai: input.loai,
    p_phien_ban: input.phienBan,
    p_tien_to: input.tienTo,
    p_site_id: input.coSo ? ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.coSo] : null,
    p_he_thong: input.heThong,
    p_kieu: input.kieu,
    p_actor_account_id: input.nguoi.id,
    p_actor_name: input.nguoi.ten,
  });
  if (error) loiKho(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return { soVanBan: String(r.so_van_ban ?? ""), phatHanhLuc: new Date(String(r.phat_hanh_luc ?? Date.now())).toISOString() };
}

export async function kyPhatHanh(id: string, maBamNoiDung: string, maBamTep: string) {
  const kho = khachKho();
  if (!kho) {
    const p = khoTam().phatHanh.get(id);
    if (!p || p.maBamNoiDung) throw new VanBanLoi(cau("VAN_BAN_KHONG_THAY"));
    p.maBamNoiDung = maBamNoiDung;
    return;
  }
  const { error } = await kho.rpc("erp_van_ban_phat_hanh_ky", {
    p_tenant_id: TENANT_ID,
    p_id: id,
    p_ma_bam_noi_dung: maBamNoiDung,
    p_ma_bam_tep: maBamTep,
  });
  if (error) loiKho(error);
}

export async function layPhatHanh(id: string): Promise<PhatHanh | null> {
  const kho = khachKho();
  if (!kho) {
    const k = khoTam();
    const p = k.phatHanh.get(id);
    if (!p) return null;
    const n = k.nop.find((x) => x.phatHanhId === id && x.ketQua !== "tra-lai");
    return { ...p, daNop: n ? { ketQua: n.ketQua as "nhan" | "cho-duyet", nopLuc: n.nopLuc, nopTen: n.nopTen } : null };
  }
  const { data, error } = await kho.rpc("erp_van_ban_lay_phat_hanh", { p_tenant_id: TENANT_ID, p_id: id });
  if (error) loiKho(error);
  return docPhatHanh(data);
}

// ---------- Nộp ----------

export async function luuTep(bytes: Uint8Array): Promise<string> {
  const duong = `van-ban/${new Date().getUTCFullYear()}/${randomUUID()}.pdf`;
  const kho = khachKho();
  if (!kho) {
    khoTam().tep.set(duong, bytes);
    return duong;
  }
  const { error } = await kho.storage.from(KHO_TEP).upload(duong, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
  if (error) {
    console.error("Van ban upload failed", error.message);
    throw new VanBanLoi("Chưa cất được tệp vào kho. Xin thử lại.");
  }
  return duong;
}

export async function boTep(duong: string) {
  const kho = khachKho();
  if (!kho) {
    khoTam().tep.delete(duong);
    return;
  }
  await kho.storage.from(KHO_TEP).remove([duong]);
}

export async function ghiNop(input: {
  phatHanhId: string | null;
  ketQua: "nhan" | "cho-duyet" | "tra-lai";
  lyDo: string;
  giaTri: Record<string, string>;
  phatHien: PhatHien[];
  ai: NhanXetAi | null;
  maBamTep: string | null;
  tenTep: string | null;
  tepPath: string | null;
  nguoi: { id: string; ten: string };
}): Promise<{ id: string | null; ketQua: string; apDung: string | null; soVanBan: string | null }> {
  const kho = khachKho();
  if (!kho) {
    const k = khoTam();
    const p = input.phatHanhId ? k.phatHanh.get(input.phatHanhId) : undefined;
    if (input.ketQua === "tra-lai") {
      const trung = k.nop.some(
        (n) => n.ketQua === "tra-lai" && n.nopBoi === input.nguoi.id && n.tenTep === input.tenTep && Date.now() - Date.parse(n.nopLuc) < 86_400_000 && n.lyDo === input.lyDo,
      );
      if (trung) return { id: null, ketQua: "tra-lai", apDung: null, soVanBan: p?.soVanBan ?? null };
    } else {
      if (!p || !p.maBamNoiDung) throw new VanBanLoi(cau("VAN_BAN_KHONG_THAY"));
      if (k.nop.some((n) => n.phatHanhId === p.id && n.ketQua !== "tra-lai")) throw new VanBanLoi(cau("VAN_BAN_DA_NOP"));
    }
    const apDung =
      input.ketQua !== "nhan"
        ? null
        : p?.loai === "hop-dong-nguoi-cheo"
          ? "Bản chạy thử ở máy không có kho, nên sổ người chèo không đổi. Trên hệ thống thật, sổ cập nhật hợp đồng của thuyền này."
          : "Văn bản vào kho văn bản để đối chiếu về sau.";
    const ban: BanNop = {
      id: randomUUID(),
      phatHanhId: p?.id ?? null,
      loai: p?.loai ?? null,
      soVanBan: p?.soVanBan ?? null,
      coSo: p?.coSo ?? null,
      ketQua: input.ketQua,
      lyDo: input.lyDo,
      giaTri: input.giaTri,
      phatHien: input.phatHien,
      ai: input.ai,
      tenTep: input.tenTep,
      coTep: Boolean(input.tepPath),
      apDung,
      nopBoi: input.nguoi.id,
      nopTen: input.nguoi.ten,
      nopLuc: new Date().toISOString(),
      duyetTen: input.ketQua === "nhan" ? input.nguoi.ten : null,
      duyetLuc: input.ketQua === "nhan" ? new Date().toISOString() : null,
      duyetGhiChu: null,
      laMau: p?.laMau ?? false,
    };
    if (input.tepPath) (ban as BanNop & { tepPath?: string }).tepPath = input.tepPath;
    k.nop.unshift(ban);
    return { id: ban.id, ketQua: ban.ketQua, apDung, soVanBan: ban.soVanBan };
  }
  const { data, error } = await kho.rpc("erp_van_ban_ghi_nop", {
    p_tenant_id: TENANT_ID,
    p_phat_hanh_id: input.phatHanhId,
    p_ket_qua: input.ketQua,
    p_ly_do: input.lyDo,
    p_gia_tri: input.giaTri,
    p_phat_hien: input.phatHien,
    p_ai: input.ai,
    p_ma_bam_tep: input.maBamTep,
    p_ten_tep: input.tenTep,
    p_tep_path: input.tepPath,
    p_actor_account_id: input.nguoi.id,
    p_actor_name: input.nguoi.ten,
  });
  if (error) loiKho(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    id: typeof r.id === "string" ? r.id : null,
    ketQua: String(r.ket_qua ?? input.ketQua),
    apDung: typeof r.ap_dung === "string" ? r.ap_dung : null,
    soVanBan: typeof r.so_van_ban === "string" ? r.so_van_ban : null,
  };
}

export async function duyetNop(input: { id: string; quyet: "nhan" | "tra-lai"; ghiChu: string; nguoi: { id: string; ten: string }; vaiDuoc: (loai: LoaiVanBan) => boolean }) {
  const kho = khachKho();
  if (!kho) {
    const n = khoTam().nop.find((x) => x.id === input.id);
    if (!n) throw new VanBanLoi(cau("VAN_BAN_KHONG_THAY"));
    if (n.ketQua !== "cho-duyet") throw new VanBanLoi(cau("VAN_BAN_DA_DUYET"));
    if (!n.loai || !input.vaiDuoc(n.loai)) throw new VanBanLoi(cau("VAN_BAN_ROLE_REQUIRED"));
    if (input.quyet === "tra-lai" && input.ghiChu.trim().length < 3) throw new VanBanLoi(cau("VAN_BAN_CAN_LY_DO"));
    n.ketQua = input.quyet;
    n.duyetTen = input.nguoi.ten;
    n.duyetLuc = new Date().toISOString();
    n.duyetGhiChu = input.ghiChu.trim() || null;
    n.apDung = input.quyet === "nhan" ? "Văn bản vào kho văn bản (bản chạy thử ở máy)." : null;
    return { apDung: n.apDung };
  }
  const { data, error } = await kho.rpc("erp_van_ban_duyet", {
    p_tenant_id: TENANT_ID,
    p_nop_id: input.id,
    p_quyet: input.quyet,
    p_ghi_chu: input.ghiChu,
    p_actor_account_id: input.nguoi.id,
    p_actor_name: input.nguoi.ten,
  });
  if (error) loiKho(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return { apDung: typeof r.ap_dung === "string" ? r.ap_dung : null };
}

export async function danhSachVanBan(): Promise<DanhSachVanBan> {
  const kho = khachKho();
  if (!kho) {
    const k = khoTam();
    const phatHanh = [...k.phatHanh.values()].filter((p) => p.maBamNoiDung);
    return {
      nop: [...k.nop].sort((a, b) => Number(b.ketQua !== "tra-lai") - Number(a.ketQua !== "tra-lai") || b.nopLuc.localeCompare(a.nopLuc)),
      soPhatHanh: phatHanh.length,
      phatHanhGan: phatHanh
        .sort((a, b) => b.phatHanhLuc.localeCompare(a.phatHanhLuc))
        .slice(0, 12)
        .map((p) => ({ id: p.id, loai: p.loai, soVanBan: p.soVanBan, kieu: p.kieu, phatHanhTen: p.phatHanhTen, phatHanhLuc: p.phatHanhLuc, daNop: k.nop.some((n) => n.phatHanhId === p.id && n.ketQua !== "tra-lai") })),
    };
  }
  const { data, error } = await kho.rpc("erp_van_ban_danh_sach", { p_tenant_id: TENANT_ID });
  if (error) loiKho(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    nop: (Array.isArray(r.nop) ? r.nop : []).map(docNop).filter((n): n is BanNop => n !== null),
    soPhatHanh: Number(r.so_phat_hanh ?? r.phat_hanh ?? 0),
    phatHanhGan: (Array.isArray(r.phat_hanh_gan) ? r.phat_hanh_gan : []).map((x) => {
      const y = x as Record<string, unknown>;
      return {
        id: String(y.id),
        loai: y.loai as LoaiVanBan,
        soVanBan: String(y.so_van_ban ?? ""),
        kieu: (y.kieu as KieuBanThu) ?? "trong",
        phatHanhTen: String(y.phat_hanh_ten ?? ""),
        phatHanhLuc: new Date(String(y.phat_hanh_luc ?? Date.now())).toISOString(),
        daNop: y.da_nop === true,
      };
    }),
  };
}

/** Văn bản đang có hiệu lực trong hệ thống, dùng cho đối chiếu. */
export function vanBanDaCo(ds: DanhSachVanBan): VanBanDaCo[] {
  return ds.nop
    .filter((n): n is BanNop & { loai: LoaiVanBan; soVanBan: string; ketQua: "nhan" | "cho-duyet" } => n.ketQua !== "tra-lai" && Boolean(n.loai && n.soVanBan))
    .map((n) => ({ id: n.id, loai: n.loai, soVanBan: n.soVanBan, coSo: n.coSo, giaTri: n.giaTri, ketQua: n.ketQua, laMau: n.laMau }));
}

export async function moTep(nopId: string): Promise<{ url: string } | { bytes: Uint8Array } | null> {
  const kho = khachKho();
  if (!kho) {
    const n = khoTam().nop.find((x) => x.id === nopId) as (BanNop & { tepPath?: string }) | undefined;
    const bytes = n?.tepPath ? khoTam().tep.get(n.tepPath) : undefined;
    return bytes ? { bytes } : null;
  }
  const { data, error } = await kho.rpc("erp_van_ban_tep", { p_tenant_id: TENANT_ID, p_nop_id: nopId });
  if (error) loiKho(error);
  if (typeof data !== "string" || !data) return null;
  const ky = await kho.storage.from(KHO_TEP).createSignedUrl(data, 120, { download: true });
  return ky.data?.signedUrl ? { url: ky.data.signedUrl } : null;
}
