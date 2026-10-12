"use server";

import { revalidatePath } from "next/cache";
import { isErpSiteId } from "@/domain/erp";
import { laLoaiKhanCap, type BaoDong } from "@/domain/khan-cap";
import { dayBaoDong } from "@/lib/erp/day-thong-bao";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import {
  baoDongCuaToi,
  baoKhanCap,
  ghiDaGoi,
  KhanCapError,
  luuDangKyDay,
  nhanBaoDong,
} from "@/lib/erp/khan-cap-repository";

/**
 * Báo khẩn cấp (migration 121). Quyền thật kiểm trong kho: ai có phân công ở
 * cơ sở ấy (hay giám đốc) thì báo được; chỉ cấp trên của cơ sở nhận được.
 */

type Ket<T> = ({ ok: true } & T) | { ok: false; message: string };

function chuLoi(error: unknown) {
  return error instanceof KhanCapError ? error.message : "Chưa gửi được. Bấm gửi lại, hoặc gọi thẳng cấp trên.";
}

function so(x: FormDataEntryValue | null): number | null {
  if (typeof x !== "string" || !x.trim()) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export async function baoKhanCapAction(form: FormData): Promise<Ket<{ baoDong: BaoDong; dayToi: number }>> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết. Gọi thẳng cấp trên." };
  const siteId = String(form.get("siteId") ?? "");
  const loai = String(form.get("loai") ?? "");
  if (!isErpSiteId(siteId)) return { ok: false, message: "Chọn cơ sở nơi xảy ra việc." };
  if (user.role !== "director" && !user.siteIds.includes(siteId)) {
    return { ok: false, message: "Tài khoản này không được phân công ở cơ sở ấy." };
  }
  if (!laLoaiKhanCap(loai)) return { ok: false, message: "Chọn loại việc khẩn cấp." };
  const viDo = so(form.get("viDo"));
  const kinhDo = so(form.get("kinhDo"));
  const anh = form.get("anh");
  try {
    const baoDong = await baoKhanCap({
      siteId,
      actorAccountId: user.id,
      actorName: user.name,
      loai,
      ghiChu: String(form.get("ghiChu") ?? "").slice(0, 300),
      viDo: viDo !== null && kinhDo !== null ? viDo : null,
      kinhDo: viDo !== null && kinhDo !== null ? kinhDo : null,
      saiSoM: so(form.get("saiSoM")),
      anh: anh instanceof File ? anh : null,
      requestKey: String(form.get("requestKey") ?? ""),
    });
    // Đẩy thông báo không được làm chậm hay làm hỏng lần báo.
    const dayToi = await dayBaoDong(baoDong).catch(() => 0);
    revalidatePath(`/erp/${siteId}/su-co`);
    return { ok: true, baoDong, dayToi };
  } catch (error) {
    return { ok: false, message: chuLoi(error) };
  }
}

/** Người báo hỏi: đã có ai nhận chưa. */
export async function xemBaoDongAction(ma: string): Promise<Ket<{ baoDong: BaoDong | null; bayGio: string }>> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết." };
  try {
    return { ok: true, baoDong: await baoDongCuaToi(user.id, String(ma)), bayGio: new Date().toISOString() };
  } catch (error) {
    return { ok: false, message: chuLoi(error) };
  }
}

export async function nhanBaoDongAction(ma: string): Promise<Ket<{ baoDong: BaoDong }>> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết." };
  try {
    return { ok: true, baoDong: await nhanBaoDong(user.id, user.name, String(ma)) };
  } catch (error) {
    return { ok: false, message: chuLoi(error) };
  }
}

/** Máy người báo đã mở cuộc gọi (tự động sau 2 phút, hay người báo bấm). */
export async function ghiDaGoiAction(ma: string, goiToiTen: string): Promise<Ket<object>> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết." };
  try {
    await ghiDaGoi(user.id, String(ma), String(goiToiTen).slice(0, 200));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: chuLoi(error) };
  }
}

/** Sau một phút chưa ai nhận: đẩy thông báo lần nữa. */
export async function nhacLaiBaoDongAction(ma: string): Promise<Ket<{ dayToi: number }>> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết." };
  try {
    const bd = await baoDongCuaToi(user.id, String(ma));
    if (!bd || bd.nhanLuc || bd.nguoiBaoAccountId !== user.id) return { ok: true, dayToi: 0 };
    return { ok: true, dayToi: await dayBaoDong(bd, true).catch(() => 0) };
  } catch (error) {
    return { ok: false, message: chuLoi(error) };
  }
}

export async function luuDangKyDayAction(dk: { endpoint: string; p256dh: string; auth: string }): Promise<Ket<object>> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết." };
  const endpoint = String(dk?.endpoint ?? "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) return { ok: false, message: "Đăng ký thông báo không hợp lệ." };
  try {
    await luuDangKyDay(user.id, { endpoint, p256dh: String(dk.p256dh ?? ""), auth: String(dk.auth ?? "") });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: chuLoi(error) };
  }
}
