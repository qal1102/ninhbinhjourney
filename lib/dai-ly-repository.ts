import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { docBangThang, docDonGanDay, laMaDaiLy, type DongDaiLy } from "@/domain/dai-ly";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class DaiLyLoi extends Error {}

function khachKho(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-dai-ly" } },
  });
}

function canKho(): SupabaseClient {
  const kho = khachKho();
  if (!kho) throw new DaiLyLoi("Chưa nối kho dữ liệu ở bản chạy này.");
  return kho;
}

function bamKhoa(khoa: string) {
  return createHash("sha256").update(`dai-ly:${khoa}`).digest("hex");
}

function loiKho(error: { code?: string; message?: string }): never {
  const m = error.message ?? "";
  if (m.includes("DAI_LY_TRUNG_MA")) throw new DaiLyLoi("Mã này đã có đại lý khác dùng. Chọn mã khác.");
  if (m.includes("DAI_LY_DA_CHI")) throw new DaiLyLoi("Tháng này đã ghi chi cho đại lý này rồi.");
  if (m.includes("DAI_LY_THANG_CHUA_KHEP")) throw new DaiLyLoi("Tháng chưa khép, chưa ghi chi được. Hoa hồng tháng này vẫn đang tạm tính.");
  if (m.includes("DAI_LY_KHONG_CO")) throw new DaiLyLoi("Không tìm thấy đại lý này.");
  console.error("Agency store failed", error);
  throw new DaiLyLoi("Chưa ghi được vào kho. Xin thử lại.");
}

/** Khoá mới cho cổng đại lý: trả khoá gốc (chỉ hiện một lần) và băm để lưu. */
function khoaMoi() {
  const khoa = randomBytes(18).toString("base64url");
  return { khoa, bam: bamKhoa(khoa) };
}

export type BangDaiLy =
  | { trangThai: "co"; dong: DongDaiLy[] }
  | { trangThai: "chua-noi-kho" }
  | { trangThai: "loi"; loiNhan: string };

export async function docBangDaiLy(thang: string): Promise<BangDaiLy> {
  const kho = khachKho();
  if (!kho) return { trangThai: "chua-noi-kho" };
  const { data, error } = await kho.rpc("erp_dai_ly_thang", { p_tenant_id: TENANT_ID, p_thang: `${thang}-01` });
  if (error) {
    console.error("Agency month read failed", error);
    return {
      trangThai: "loi",
      loiNhan: error.code === "PGRST202" || error.code === "42883" ? "Kho chưa có sổ đại lý (migration 099 chưa áp)." : "Chưa đọc được sổ đại lý. Xin tải lại trang.",
    };
  }
  const dong = docBangThang(data);
  // `erp_dai_ly_thang` (102) chưa trả loại; đọc riêng cột `loai` (116). Kho
  // chưa có cột thì mọi dòng là đại lý như trước.
  const { data: loai, error: loiLoai } = await kho.from("dai_ly").select("id, loai").eq("tenant_id", TENANT_ID);
  if (!loiLoai) {
    const theoId = new Map((loai ?? []).map((row) => [String(row.id), row.loai === "nguoi-cheo" ? "nguoi-cheo" : "dai-ly"] as const));
    for (const d of dong) d.loai = theoId.get(d.id) ?? "dai-ly";
  } else if (loiLoai.code !== "42703") {
    console.error("Agency type read failed", loiLoai);
  }
  return { trangThai: "co", dong };
}

export async function docDonCuaDaiLy(daiLyId: string, gioiHan = 20) {
  const { data, error } = await canKho().rpc("dai_ly_don_gan_day", {
    p_tenant_id: TENANT_ID,
    p_dai_ly_id: daiLyId,
    p_gioi_han: gioiHan,
  });
  if (error) loiKho(error);
  return docDonGanDay(data);
}

/** Tên đại lý nếu mã còn hợp tác; không thì null. Lỗi kho cũng trả null: đừng chặn khách. */
export async function daiLyConHopTac(ma: string): Promise<string | null> {
  if (!laMaDaiLy(ma)) return null;
  const kho = khachKho();
  if (!kho) return null;
  const { data, error } = await kho.rpc("dai_ly_con_hop_tac", { p_tenant_id: TENANT_ID, p_ma: ma });
  if (error) {
    console.error("Agency lookup failed", error);
    return null;
  }
  return typeof data === "string" ? data : null;
}

/** Ghi đơn vừa giữ chỗ cho đại lý. Không bao giờ ném: hỏng thì đơn vẫn đặt được. */
export async function ganDonChoDaiLy(ma: string, orderId: string) {
  if (!laMaDaiLy(ma)) return false;
  const kho = khachKho();
  if (!kho) return false;
  const { data, error } = await kho.rpc("dai_ly_gan_don", { p_tenant_id: TENANT_ID, p_ma: ma, p_order_id: orderId });
  if (error) {
    console.error("Agency order link failed", error);
    return false;
  }
  return data === true;
}

export async function moCongDaiLy(ma: string, khoa: string) {
  if (!laMaDaiLy(ma) || !/^[A-Za-z0-9_-]{16,64}$/.test(khoa)) return null;
  const kho = khachKho();
  if (!kho) return null;
  const { data, error } = await kho.rpc("dai_ly_mo_cong", { p_tenant_id: TENANT_ID, p_ma: ma, p_khoa_bam: bamKhoa(khoa) });
  if (error) {
    console.error("Agency portal open failed", error);
    return null;
  }
  const r = data as { id?: string } | null;
  return r?.id ? r.id : null;
}

export async function taoDaiLy(input: {
  ma: string;
  ten: string;
  nguoiLienHe: string;
  dienThoai: string;
  tyLe: number;
  nguoi: string;
}) {
  const { khoa, bam } = khoaMoi();
  const { error } = await canKho().rpc("erp_dai_ly_tao", {
    p_tenant_id: TENANT_ID,
    p_ma: input.ma,
    p_ten: input.ten,
    p_nguoi_lien_he: input.nguoiLienHe,
    p_dien_thoai: input.dienThoai,
    p_ty_le: input.tyLe,
    p_khoa_bam: bam,
    p_nguoi: input.nguoi,
  });
  if (error) loiKho(error);
  return { khoa };
}

export async function capKhoaMoi(id: string) {
  const { khoa, bam } = khoaMoi();
  const { data, error } = await canKho().rpc("erp_dai_ly_cap_nhat", {
    p_tenant_id: TENANT_ID,
    p_id: id,
    p_ty_le: null,
    p_trang_thai: null,
    p_khoa_bam: bam,
  });
  if (error) loiKho(error);
  if (data !== true) throw new DaiLyLoi("Không tìm thấy đại lý này.");
  return { khoa };
}

export async function doiTrangThaiDaiLy(id: string, trangThai: "hop-tac" | "tam-ngung") {
  const { data, error } = await canKho().rpc("erp_dai_ly_cap_nhat", {
    p_tenant_id: TENANT_ID,
    p_id: id,
    p_ty_le: null,
    p_trang_thai: trangThai,
    p_khoa_bam: null,
  });
  if (error) loiKho(error);
  if (data !== true) throw new DaiLyLoi("Không tìm thấy đại lý này.");
}

export async function ghiDaChi(id: string, thang: string, ghiChu: string, nguoi: string) {
  const { data, error } = await canKho().rpc("erp_dai_ly_ghi_chi", {
    p_tenant_id: TENANT_ID,
    p_id: id,
    p_thang: `${thang}-01`,
    p_ghi_chu: ghiChu,
    p_nguoi: nguoi,
  });
  if (error) loiKho(error);
  return Number(data ?? 0);
}
