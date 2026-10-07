import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  dauNgayVietNam,
  docChuyenTrenSong,
  ngayNenXem,
  type CoSoThuyen,
  type DoiThuyen,
  type DuLieuBen,
  type GioiThieuNguoiCheo,
  type NguoiCheo,
  xepSoNguoiCheo,
} from "@/domain/thuyen-song";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";
import { docBangDaiLy } from "@/lib/dai-ly-repository";
import { thangHienTai } from "@/domain/dai-ly";

/** Thuyền trên sông (migration 104): chuyến của người chèo, bản đồ sống và bến. */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class ThuyenLoi extends Error {
  constructor(message: string, readonly ma: "CHUA_NOI_KHO" | "KHONG_CO" | "DA_DONG" | "LOI") {
    super(message);
  }
}

function khachKho(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (process.env.ERP_PERSISTENCE_MODE?.trim() !== "supabase" || !url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-thuyen" } },
  });
}

export function thuyenCoKho(): boolean {
  return khachKho() !== null;
}

function canKho(): SupabaseClient {
  const kho = khachKho();
  if (!kho) throw new ThuyenLoi("Bản đồ thuyền chưa nối kho dữ liệu.", "CHUA_NOI_KHO");
  return kho;
}

function loiKho(error: { code?: string; message?: string }): never {
  const m = error.message ?? "";
  if (m.includes("THUYEN_KHONG_CO_CHUYEN")) throw new ThuyenLoi("Không thấy chuyến này của bạn.", "KHONG_CO");
  if (m.includes("THUYEN_CHUYEN_DA_DONG")) throw new ThuyenLoi("Chuyến đã về bến. Bắt đầu chuyến mới nhé.", "DA_DONG");
  console.error("Boat store failed", error);
  throw new ThuyenLoi("Chưa ghi được vị trí thuyền. Xin thử lại.", "LOI");
}

export type ChuyenCuaToi = { id: string; coSo: CoSoThuyen; soThuyen: string; soKhach: number; batDau: string };

function docChuyen(row: unknown): ChuyenCuaToi | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0) return null;
  const coSo = (Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).find(([, uuid]) => uuid === r.site_id)?.[0] ?? "") as CoSoThuyen;
  if (coSo !== "trang-an" && coSo !== "tam-coc") return null;
  return {
    id: r.id,
    coSo,
    soThuyen: String(r.so_thuyen ?? ""),
    soKhach: Number(r.so_khach ?? 0),
    batDau: String(r.bat_dau ?? ""),
  };
}

export async function chuyenCuaToi(accountId: string): Promise<ChuyenCuaToi | null> {
  const kho = khachKho();
  if (!kho) return null;
  const { data, error } = await kho.rpc("erp_thuyen_chuyen_cua_toi", { p_tenant_id: TENANT_ID, p_account_id: accountId });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    loiKho(error);
  }
  return docChuyen(data);
}

export async function batDauChuyen(coSo: CoSoThuyen, accountId: string, soThuyen: string, soKhach: number) {
  const { data, error } = await canKho().rpc("erp_thuyen_bat_dau", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[coSo],
    p_account_id: accountId,
    p_so_thuyen: soThuyen,
    p_so_khach: soKhach,
  });
  if (error) loiKho(error);
  const chuyen = docChuyen(data);
  if (!chuyen) throw new ThuyenLoi("Chưa mở được chuyến. Xin thử lại.", "LOI");
  return chuyen;
}

export async function guiViTri(
  chuyenId: string,
  accountId: string,
  viTri: { lat: number; lng: number; doChinhXac: number | null; tocDo: number | null; huong: number | null },
) {
  const { data, error } = await canKho().rpc("erp_thuyen_gui_vi_tri", {
    p_tenant_id: TENANT_ID,
    p_chuyen_id: chuyenId,
    p_account_id: accountId,
    p_lat: viTri.lat,
    p_lng: viTri.lng,
    p_do_chinh_xac: viTri.doChinhXac,
    p_toc_do: viTri.tocDo,
    p_huong: viTri.huong,
  });
  if (error) loiKho(error);
  return data === true;
}

export async function veBen(chuyenId: string, accountId: string) {
  const { error } = await canKho().rpc("erp_thuyen_ve_ben", {
    p_tenant_id: TENANT_ID,
    p_chuyen_id: chuyenId,
    p_account_id: accountId,
  });
  if (error) loiKho(error);
}

export async function thuyenTrenSong(coSo: CoSoThuyen) {
  const { data, error } = await canKho().rpc("erp_thuyen_tren_song", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[coSo],
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return [];
    loiKho(error);
  }
  return docChuyenTrenSong(data);
}

const MOT_TRANG = 1000;

/**
 * Dữ liệu bến của một ngày: đội thuyền từ ngưỡng bến ở màn Sức chứa (một
 * nguồn duy nhất, người vận hành sửa ở đó) và giờ từng lượt khách qua cổng.
 * Chỉ trả giờ, không trả mã vé hay người quét.
 */
export async function benThuyen(coSo: CoSoThuyen, bayGioMs: number): Promise<DuLieuBen> {
  const kho = canKho();
  const siteId = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[coSo];
  const ngay = ngayNenXem(bayGioMs);
  const dau = dauNgayVietNam(ngay);
  const cuoi = Math.min(dau + 86_400_000, bayGioMs);

  const nguong = await kho
    .from("erp_capacity_thresholds")
    .select("vehicle_count, seats_per_vehicle, round_trip_minutes, source_kind, source_note")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", siteId)
    .eq("bottleneck_kind", "boat-pier")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (nguong.error) loiKho(nguong.error);
  const n = nguong.data as Record<string, unknown> | null;
  const doi: DoiThuyen | null = n
    ? {
        soThuyen: Number(n.vehicle_count),
        choMoiThuyen: Number(n.seats_per_vehicle),
        phutMotVong: Number(n.round_trip_minutes),
        nguon: String(n.source_note ?? ""),
        loaiNguon: n.source_kind === "customer" || n.source_kind === "measured" ? n.source_kind : "estimate",
      }
    : null;

  // Kho trả tối đa 1.000 dòng một lần; ngày đông Tràng An vượt mức ấy.
  const luotVao: number[] = [];
  for (let trang = 0; trang < 20; trang++) {
    const { data, error } = await kho
      .from("erp_gate_scan_events")
      .select("scanned_at")
      .eq("tenant_id", TENANT_ID)
      .eq("site_id", siteId)
      .eq("result", "accepted")
      .gte("scanned_at", new Date(dau).toISOString())
      .lt("scanned_at", new Date(cuoi).toISOString())
      .order("scanned_at", { ascending: true })
      .range(trang * MOT_TRANG, trang * MOT_TRANG + MOT_TRANG - 1);
    if (error) loiKho(error);
    for (const row of data ?? []) {
      const luc = Date.parse(String((row as { scanned_at: unknown }).scanned_at));
      if (Number.isFinite(luc)) luotVao.push(luc);
    }
    if ((data ?? []).length < MOT_TRANG) break;
  }
  return { ngay, doi, luotVao, nguoiCheo: await soNguoiCheo(coSo) };
}

/** Sổ người chèo của bến (migration 111, hồ sơ 112). Kho chưa có bảng thì trả sổ rỗng. */
export async function soNguoiCheo(coSo: CoSoThuyen): Promise<NguoiCheo[]> {
  const kho = khachKho();
  if (!kho) return [];
  const doc = (cot: string) =>
    kho.from("erp_nguoi_cheo").select(cot).eq("tenant_id", TENANT_ID).eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[coSo]).limit(2000);
  let { data, error } = await doc("id, so_thuyen, ho_ten, so_dien_thoai, la_mau, que_quan, nam_vao_nghe, ngon_ngu, ghi_chu, dai_ly_id");
  // Kho chưa áp 116 thì chưa có mã giới thiệu, chưa áp 112 thì chưa có cột hồ
  // sơ: lùi dần, vẫn đọc sổ như cũ.
  if (error?.code === "42703") ({ data, error } = await doc("id, so_thuyen, ho_ten, so_dien_thoai, la_mau, que_quan, nam_vao_nghe, ngon_ngu, ghi_chu"));
  if (error?.code === "42703") ({ data, error } = await doc("id, so_thuyen, ho_ten, so_dien_thoai, la_mau, ghi_chu"));
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    loiKho(error);
  }
  const gioiThieu = await gioiThieuTheoDaiLy(
    (data ?? []).some((row) => typeof (row as unknown as Record<string, unknown>).dai_ly_id === "string"),
  );
  return xepSoNguoiCheo(
    (data ?? []).map((row) => {
      const d = row as unknown as Record<string, unknown>;
      return {
        gioiThieu: typeof d.dai_ly_id === "string" ? (gioiThieu.get(d.dai_ly_id) ?? null) : null,
        id: String(d.id),
        soThuyen: String(d.so_thuyen),
        hoTen: String(d.ho_ten),
        soDienThoai: chu(d.so_dien_thoai),
        laMau: d.la_mau === true,
        queQuan: chu(d.que_quan),
        namVaoNghe: typeof d.nam_vao_nghe === "number" ? d.nam_vao_nghe : null,
        ngonNgu: chu(d.ngon_ngu),
        ghiChu: chu(d.ghi_chu),
      };
    }),
  );
}

/**
 * Số giới thiệu tháng này của mọi mã trong sổ đại lý, theo id đại lý. Một lượt
 * đọc cho cả bến; đọc hỏng thì sổ vẫn hiện, chỉ thiếu phần hoa hồng.
 */
// Bản đồ và sổ cùng hỏi lại API bến mỗi phút; bảng hoa hồng tháng phải dò lượt
// qua cổng của từng đơn, nên nhớ 5 phút cho mỗi máy chủ.
const NHO_GIOI_THIEU_MS = 5 * 60_000;
let nhoGioiThieu: { thang: string; luc: number; bang: Map<string, GioiThieuNguoiCheo> } | null = null;

async function gioiThieuTheoDaiLy(canDoc: boolean): Promise<Map<string, GioiThieuNguoiCheo>> {
  const ket = new Map<string, GioiThieuNguoiCheo>();
  if (!canDoc) return ket;
  const thang = thangHienTai();
  if (nhoGioiThieu && nhoGioiThieu.thang === thang && Date.now() - nhoGioiThieu.luc < NHO_GIOI_THIEU_MS) {
    return nhoGioiThieu.bang;
  }
  const bang = await docBangDaiLy(thang).catch(() => null);
  if (!bang || bang.trangThai !== "co") return ket;
  for (const d of bang.dong) {
    ket.set(d.id, {
      ma: d.ma,
      tyLe: d.tyLe,
      thang,
      don: d.don,
      khach: d.khach,
      khachToi: d.khachToi,
      doanhThuToi: d.doanhThuToi,
      hoaHong: d.hoaHong,
      daChi: d.daChi,
      trangThaiChi: d.trangThaiChi,
      dangHopTac: d.trangThai === "hop-tac",
    });
  }
  nhoGioiThieu = { thang, luc: Date.now(), bang: ket };
  return ket;
}

/** Cấp mã giới thiệu cho một người chèo (116). Đã có mã thì trả lại mã cũ. */
export async function capMaGioiThieu(coSo: CoSoThuyen, id: string, tyLe: number, nguoi: string): Promise<string> {
  const kho = canKho();
  const { data: nguoiCheo, error: loiDoc } = await kho
    .from("erp_nguoi_cheo")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[coSo])
    .eq("id", id)
    .maybeSingle();
  if (loiDoc) loiKho(loiDoc);
  if (!nguoiCheo) throw new ThuyenLoi("Người này không có trong sổ của bến.", "LOI");
  const { data, error } = await kho.rpc("erp_nguoi_cheo_cap_ma", {
    p_tenant_id: TENANT_ID,
    p_nguoi_cheo_id: id,
    p_ty_le: tyLe,
    p_tao_boi: nguoi,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new ThuyenLoi("Kho chưa có mã giới thiệu cho người chèo (migration 116 chưa áp).", "CHUA_NOI_KHO");
    }
    loiKho(error);
  }
  nhoGioiThieu = null;
  return String(data);
}

function chu(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

export type GhiNguoiCheo = {
  id?: string;
  coSo: CoSoThuyen;
  soThuyen: string;
  hoTen: string;
  soDienThoai: string | null;
  queQuan: string | null;
  namVaoNghe: number | null;
  ngonNgu: string | null;
  ghiChu: string | null;
};

/** Thêm hay sửa một người trong sổ. Trùng số thuyền trong cùng bến thì báo. */
export async function ghiNguoiCheo(v: GhiNguoiCheo): Promise<void> {
  const kho = canKho();
  const dong = {
    tenant_id: TENANT_ID,
    site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[v.coSo],
    so_thuyen: v.soThuyen.trim(),
    ho_ten: v.hoTen.trim(),
    so_dien_thoai: v.soDienThoai?.trim() || null,
    que_quan: v.queQuan?.trim() || null,
    nam_vao_nghe: v.namVaoNghe,
    ngon_ngu: v.ngonNgu?.trim() || null,
    ghi_chu: v.ghiChu?.trim() || null,
    // Sửa tay là thành người thật trong sổ, thôi nhãn "mẫu".
    la_mau: false,
    sua_luc: new Date().toISOString(),
  };
  const { error } = v.id
    ? await kho.from("erp_nguoi_cheo").update(dong).eq("tenant_id", TENANT_ID).eq("id", v.id)
    : await kho.from("erp_nguoi_cheo").insert(dong);
  if (error) {
    if (error.code === "23505") throw new ThuyenLoi("Số thuyền này đã có người trong sổ của bến.", "LOI");
    if (error.code === "42P01" || error.code === "PGRST205") throw new ThuyenLoi("Kho chưa có sổ người chèo (migration 111 chưa áp).", "CHUA_NOI_KHO");
    if (error.code === "42703") throw new ThuyenLoi("Kho chưa có cột hồ sơ người chèo (migration 112 chưa áp).", "CHUA_NOI_KHO");
    loiKho(error);
  }
}

export async function xoaNguoiCheo(coSo: CoSoThuyen, id: string): Promise<void> {
  const kho = canKho();
  const { error } = await kho
    .from("erp_nguoi_cheo")
    .delete()
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[coSo])
    .eq("id", id);
  if (error) loiKho(error);
}
