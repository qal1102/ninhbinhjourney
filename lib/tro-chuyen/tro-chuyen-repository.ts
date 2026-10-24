import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Phong, TepDinhKem, TheGan, ThanhVien, TinNhan, ViecTrongTin } from "@/domain/tro-chuyen";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";

/**
 * Kho trò chuyện (migration 133). Production đi các hàm SQL; ở máy không có
 * kho thì giữ trong bộ nhớ máy chủ (khởi động lại là mất), có một phòng mẫu
 * như migration gieo.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const KHO_TEP = "erp-tro-chuyen";

export class TroChuyenLoi extends Error {}

function khachKho(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-tro-chuyen" } },
  });
}

export function luuTruTroChuyen(): "supabase" | "memory" {
  return khachKho() ? "supabase" : "memory";
}

/** Câu tiếng Việt của mã lỗi, lấy từ bảng chung `rpc-error-messages` (một nguồn). */
function cau(ma: string) {
  return findRpcBusinessMessage({ message: ma }) ?? "Chưa làm được. Xin thử lại.";
}

function loiKho(error: { code?: string; message?: string }): never {
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42P01") {
    throw new TroChuyenLoi("Kho chưa có phần trò chuyện. Xin báo người quản trị hệ thống.");
  }
  const cau = findRpcBusinessMessage(error);
  if (cau) throw new TroChuyenLoi(cau);
  console.error("Tro chuyen store failed", error);
  throw new TroChuyenLoi("Kho trò chuyện chưa trả lời. Xin thử lại.");
}

const iso = (v: unknown) => (typeof v === "string" ? new Date(v).toISOString() : new Date().toISOString());

function docPhong(row: unknown): Phong | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const tc = r.tin_cuoi && typeof r.tin_cuoi === "object" ? (r.tin_cuoi as Record<string, unknown>) : null;
  return {
    id: r.id,
    loai: r.loai === "nhom" ? "nhom" : "rieng",
    ten: typeof r.ten === "string" ? r.ten : null,
    kenh: String(r.kenh ?? ""),
    tinCuoiLuc: iso(r.tin_cuoi_luc),
    laMau: r.la_mau === true,
    thanhVien: (Array.isArray(r.thanh_vien) ? r.thanh_vien : []).map((v) => {
      const x = v as Record<string, unknown>;
      return { id: String(x.id), ten: String(x.ten ?? ""), docDen: iso(x.docDen) };
    }),
    tinCuoi: tc
      ? {
          nguoiGui: String(tc.nguoiGui ?? ""),
          ten: String(tc.ten ?? ""),
          noiDung: String(tc.noiDung ?? ""),
          soTep: Number(tc.soTep ?? 0),
          soGan: Number(tc.soGan ?? 0),
          luc: iso(tc.luc),
          loai: String(tc.loai ?? "chu"),
        }
      : null,
    chuaDoc: Number(r.chua_doc ?? 0),
  };
}

function docTin(row: unknown): TinNhan | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const v = r.viec && typeof r.viec === "object" ? (r.viec as Record<string, unknown>) : null;
  return {
    id: r.id,
    nguoiGui: String(r.nguoi_gui ?? ""),
    tenNguoiGui: String(r.ten_nguoi_gui ?? ""),
    loai: r.loai === "he-thong" ? "he-thong" : "chu",
    noiDung: String(r.noi_dung ?? ""),
    tep: Array.isArray(r.tep) ? (r.tep as TepDinhKem[]) : [],
    gan: Array.isArray(r.gan) ? (r.gan as TheGan[]) : [],
    taoLuc: iso(r.tao_luc),
    laMau: r.la_mau === true,
    viec: v
      ? {
          id: String(v.id),
          nguoiNhan: typeof v.nguoiNhan === "string" ? v.nguoiNhan : null,
          nguoiTao: String(v.nguoiTao ?? ""),
          han: typeof v.han === "string" ? iso(v.han) : null,
          trangThai: v.trangThai === "xong" || v.trangThai === "huy" ? v.trangThai : "mo",
          noiDung: String(v.noiDung ?? ""),
        }
      : null,
  };
}

// ---------- Kho tạm ở máy ----------

type PhongTam = Omit<Phong, "tinCuoi" | "chuaDoc" | "thanhVien"> & { khoaRieng: string | null; thanhVien: ThanhVien[]; tin: (TinNhan & { viecId: string | null })[] };
type KhoTam = { phong: Map<string, PhongTam>; tep: Map<string, { bytes: Uint8Array; kieu: string }> };

function khoTam(): KhoTam {
  const g = globalThis as { __nbjTroChuyen?: KhoTam };
  if (g.__nbjTroChuyen) return g.__nbjTroChuyen;
  const id = randomUUID();
  const truoc = (phut: number) => new Date(Date.now() - phut * 60_000).toISOString();
  const tin = (noiDung: string, phut: number, gan: TheGan[] = []): TinNhan & { viecId: string | null } => ({
    id: randomUUID(),
    nguoiGui: "manager-trang-an",
    tenNguoiGui: "Quản lý Tràng An",
    loai: "chu",
    noiDung,
    tep: [],
    gan,
    taoLuc: truoc(phut),
    laMau: true,
    viec: null,
    viecId: null,
  });
  g.__nbjTroChuyen = {
    tep: new Map(),
    phong: new Map([
      [
        id,
        {
          id,
          loai: "rieng",
          ten: null,
          kenh: randomBytes(16).toString("hex"),
          tinCuoiLuc: truoc(120),
          laMau: true,
          khoaRieng: "director-001|manager-trang-an",
          thanhVien: [
            { id: "manager-trang-an", ten: "Quản lý Tràng An", docDen: truoc(120) },
            { id: "director-001", ten: "Giám đốc", docDen: truoc(180) },
          ],
          tin: [
            tin("Hợp đồng thu gom rác HĐ-NCC-2026-0014 sắp hết giá trị, em đính kèm để giám đốc duyệt gia hạn.", 120, [
              { kieu: "van-ban", id: "VB-MAU014", ten: "Hợp đồng nhà cung cấp HĐ-NCC-2026-0014", duongDan: "/erp/van-ban" },
            ]),
            tin("Em gửi màn sức chứa để giám đốc xem giờ cao điểm, có cần mở thêm thuyền buổi chiều không ạ?", 138, [
              { kieu: "chuc-nang", id: "suc-chua-ca-vung", ten: "Sức chứa cả vùng theo giờ", duongDan: "/erp/toan-vung" },
            ]),
            tin("Thưa giám đốc, sáng nay bến Tràng An đông, hàng chờ lên tới 40 phút.", 140),
          ],
        },
      ],
    ]),
  };
  return g.__nbjTroChuyen;
}

function tomPhong(p: PhongTam, accountId: string): Phong {
  const toi = p.thanhVien.find((v) => v.id === accountId);
  const cuoi = p.tin[0];
  return {
    id: p.id,
    loai: p.loai,
    ten: p.ten,
    kenh: p.kenh,
    tinCuoiLuc: p.tinCuoiLuc,
    laMau: p.laMau,
    thanhVien: p.thanhVien,
    tinCuoi: cuoi
      ? { nguoiGui: cuoi.nguoiGui, ten: cuoi.tenNguoiGui, noiDung: cuoi.noiDung.slice(0, 140), soTep: cuoi.tep.length, soGan: cuoi.gan.length, luc: cuoi.taoLuc, loai: cuoi.loai }
      : null,
    chuaDoc: toi ? p.tin.filter((t) => t.taoLuc > toi.docDen && t.nguoiGui !== accountId).length : 0,
  };
}

// ---------- Phòng ----------

export async function dsPhong(accountId: string): Promise<Phong[]> {
  const kho = khachKho();
  if (!kho) {
    return [...khoTam().phong.values()]
      .filter((p) => p.thanhVien.some((v) => v.id === accountId))
      .sort((a, b) => b.tinCuoiLuc.localeCompare(a.tinCuoiLuc))
      .map((p) => tomPhong(p, accountId));
  }
  const { data, error } = await kho.rpc("erp_tc_ds_phong", { p_tenant_id: TENANT_ID, p_account: accountId });
  if (error) loiKho(error);
  return (Array.isArray(data) ? data : []).map(docPhong).filter((p): p is Phong => p !== null);
}

export async function moPhongRieng(a: { id: string; ten: string }, b: { id: string; ten: string }): Promise<string> {
  const kho = khachKho();
  if (!kho) {
    if (a.id === b.id) throw new TroChuyenLoi(cau("TC_NGUOI_KHONG_HOP_LE"));
    const khoa = [a.id, b.id].sort().join("|");
    const k = khoTam();
    const co = [...k.phong.values()].find((p) => p.khoaRieng === khoa);
    if (co) return co.id;
    const id = randomUUID();
    const bayGio = new Date().toISOString();
    k.phong.set(id, {
      id,
      loai: "rieng",
      ten: null,
      kenh: randomBytes(16).toString("hex"),
      tinCuoiLuc: bayGio,
      laMau: false,
      khoaRieng: khoa,
      thanhVien: [
        { id: a.id, ten: a.ten, docDen: bayGio },
        { id: b.id, ten: b.ten, docDen: bayGio },
      ],
      tin: [],
    });
    return id;
  }
  const { data, error } = await kho.rpc("erp_tc_mo_rieng", { p_tenant_id: TENANT_ID, p_a: a.id, p_ten_a: a.ten, p_b: b.id, p_ten_b: b.ten });
  if (error) loiKho(error);
  return String(data);
}

export async function taoNhom(nguoiTao: { id: string; ten: string }, ten: string, thanhVien: { id: string; ten: string }[]): Promise<string> {
  const kho = khachKho();
  if (!kho) {
    const id = randomUUID();
    const bayGio = new Date().toISOString();
    const ds = [...new Map([...thanhVien, nguoiTao].map((v) => [v.id, v])).values()];
    khoTam().phong.set(id, {
      id,
      loai: "nhom",
      ten: ten.trim(),
      kenh: randomBytes(16).toString("hex"),
      tinCuoiLuc: bayGio,
      laMau: false,
      khoaRieng: null,
      thanhVien: ds.map((v) => ({ ...v, docDen: bayGio })),
      tin: [
        { id: randomUUID(), nguoiGui: nguoiTao.id, tenNguoiGui: nguoiTao.ten, loai: "he-thong", noiDung: `${nguoiTao.ten} lập nhóm "${ten.trim()}".`, tep: [], gan: [], taoLuc: bayGio, laMau: false, viec: null, viecId: null },
      ],
    });
    return id;
  }
  const { data, error } = await kho.rpc("erp_tc_tao_nhom", {
    p_tenant_id: TENANT_ID,
    p_nguoi_tao: nguoiTao.id,
    p_ten_nguoi_tao: nguoiTao.ten,
    p_ten: ten,
    p_thanh_vien: thanhVien,
  });
  if (error) loiKho(error);
  return String(data);
}

// ---------- Tin ----------

export async function tinCuaPhong(
  phongId: string,
  accountId: string,
  truoc: string | null,
  docViec: (id: string) => Promise<ViecTrongTin | null>,
): Promise<TinNhan[]> {
  const kho = khachKho();
  if (!kho) {
    const p = khoTam().phong.get(phongId);
    if (!p || !p.thanhVien.some((v) => v.id === accountId)) throw new TroChuyenLoi(cau("TC_KHONG_PHAI_THANH_VIEN"));
    const ds = p.tin.filter((t) => !truoc || t.taoLuc < truoc).slice(0, 40);
    return Promise.all(ds.map(async ({ viecId, ...t }) => ({ ...t, viec: viecId ? await docViec(viecId) : null })));
  }
  const { data, error } = await kho.rpc("erp_tc_tin_phong", { p_tenant_id: TENANT_ID, p_phong: phongId, p_account: accountId, p_truoc: truoc, p_gioi_han: 40 });
  if (error) loiKho(error);
  const tin = (Array.isArray(data) ? data : []).map(docTin).filter((t): t is TinNhan => t !== null);
  // Đường dẫn ký một giờ cho mọi tệp của lượt này, một lần gọi.
  const duong = tin.flatMap((t) => t.tep.map((f) => f.path));
  if (duong.length) {
    const { data: ky } = await kho.storage.from(KHO_TEP).createSignedUrls(duong, 3600);
    const theoDuong = new Map((ky ?? []).map((k) => [k.path, k.signedUrl]));
    for (const t of tin) t.tep = t.tep.map((f) => ({ ...f, url: theoDuong.get(f.path) ?? null }));
  }
  return tin;
}

export async function guiTin(input: {
  phongId: string;
  nguoi: { id: string; ten: string };
  loai?: "chu" | "he-thong";
  noiDung: string;
  tep: TepDinhKem[];
  gan: TheGan[];
  viecId: string | null;
}): Promise<{ id: string; taoLuc: string }> {
  const kho = khachKho();
  if (!kho) {
    const p = khoTam().phong.get(input.phongId);
    if (!p || !p.thanhVien.some((v) => v.id === input.nguoi.id)) throw new TroChuyenLoi(cau("TC_KHONG_PHAI_THANH_VIEN"));
    const taoLuc = new Date().toISOString();
    const id = randomUUID();
    p.tin.unshift({
      id,
      nguoiGui: input.nguoi.id,
      tenNguoiGui: input.nguoi.ten,
      loai: input.loai ?? "chu",
      noiDung: input.noiDung,
      tep: input.tep,
      gan: input.gan,
      taoLuc,
      laMau: false,
      viec: null,
      viecId: input.viecId,
    });
    p.tinCuoiLuc = taoLuc;
    p.thanhVien = p.thanhVien.map((v) => (v.id === input.nguoi.id ? { ...v, docDen: taoLuc } : v));
    return { id, taoLuc };
  }
  const { data, error } = await kho.rpc("erp_tc_gui", {
    p_tenant_id: TENANT_ID,
    p_phong: input.phongId,
    p_account: input.nguoi.id,
    p_ten: input.nguoi.ten,
    p_loai: input.loai ?? "chu",
    p_noi_dung: input.noiDung,
    p_tep: input.tep.map((f) => ({ path: f.path, ten: f.ten, co: f.co, kieu: f.kieu })),
    p_gan: input.gan,
    p_viec_id: input.viecId,
  });
  if (error) loiKho(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return { id: String(r.id), taoLuc: iso(r.tao_luc) };
}

export async function daDoc(phongId: string, accountId: string) {
  const kho = khachKho();
  if (!kho) {
    const p = khoTam().phong.get(phongId);
    if (p) p.thanhVien = p.thanhVien.map((v) => (v.id === accountId ? { ...v, docDen: new Date().toISOString() } : v));
    return;
  }
  const { error } = await kho.rpc("erp_tc_da_doc", { p_tenant_id: TENANT_ID, p_phong: phongId, p_account: accountId });
  if (error) loiKho(error);
}

export async function soChuaDoc(accountId: string): Promise<number> {
  const kho = khachKho();
  if (!kho) return (await dsPhong(accountId)).reduce((t, p) => t + p.chuaDoc, 0);
  const { data, error } = await kho.rpc("erp_tc_chua_doc", { p_tenant_id: TENANT_ID, p_account: accountId });
  if (error) loiKho(error);
  return Number(data ?? 0);
}

// ---------- Tệp ----------

export async function cauTep(phongId: string, bytes: Uint8Array, kieu: string, duoi: string): Promise<string> {
  const duong = `tc/${phongId}/${randomUUID()}.${duoi}`;
  const kho = khachKho();
  if (!kho) {
    khoTam().tep.set(duong, { bytes, kieu });
    return duong;
  }
  const { error } = await kho.storage.from(KHO_TEP).upload(duong, Buffer.from(bytes), { contentType: kieu, upsert: false });
  if (error) {
    console.error("Tro chuyen upload failed", error.message);
    throw new TroChuyenLoi("Chưa tải được tệp lên. Xin thử lại.");
  }
  return duong;
}

/** Chỉ bản chạy ở máy: tệp nằm trong bộ nhớ, đọc qua API thay cho đường dẫn ký. */
export function tepTrongMay(duong: string) {
  return khoTam().tep.get(duong) ?? null;
}
