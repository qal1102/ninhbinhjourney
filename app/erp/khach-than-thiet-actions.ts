"use server";

import { revalidatePath } from "next/cache";
import { isErpSiteId } from "@/domain/erp";
import type { CounterSaleReceipt } from "@/domain/erp-counter-sale";
import { laMaGanDuoc, type TomTatThanThiet, type VoucherQuay } from "@/domain/khach-than-thiet";
import {
  doiVoucher,
  ganMaVaoSo,
  KhachThanThietError,
  traVoucher,
} from "@/lib/customer-data/khach-than-thiet-repository";
import { accountCanAccessModule, getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * Khách thân thiết ở quầy (12/10/2026, migration 119): tra và đổi voucher,
 * gắn số điện thoại khách vào phiếu vừa bán. Ai bán vé ở cơ sở này thì làm
 * được; quyền thật kiểm lại trong kho (`erp_counter_actor_can_sell`).
 */

const LOI_CHUNG = "Chưa xử lý được. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.";

async function nguoiQuay(siteId: string) {
  const user = await getCurrentErpUser();
  if (!user) return { loi: "Phiên đăng nhập đã hết hạn." } as const;
  if (!isErpSiteId(siteId)) return { loi: "Cơ sở không hợp lệ." } as const;
  if (!accountCanAccessModule(user, siteId, "ve-dat-cho")) {
    return { loi: "Tài khoản này chưa được phân công bán vé tại cơ sở này." } as const;
  }
  return { user, siteId } as const;
}

function chuLoi(error: unknown) {
  return error instanceof KhachThanThietError ? error.message : LOI_CHUNG;
}

export async function traVoucherAction(input: {
  siteId: string;
  code: string;
}): Promise<{ ok: true; voucher: VoucherQuay } | { ok: false; message: string }> {
  const q = await nguoiQuay(input.siteId);
  if ("loi" in q) return { ok: false, message: q.loi ?? LOI_CHUNG };
  const code = String(input.code ?? "").trim().toUpperCase();
  if (!/^VC-[A-Z0-9]{8}$/.test(code)) return { ok: false, message: "Mã voucher có dạng VC- và 8 ký tự." };
  try {
    const voucher = await traVoucher(code);
    return voucher ? { ok: true, voucher } : { ok: false, message: "Không tìm thấy voucher này." };
  } catch (error) {
    return { ok: false, message: chuLoi(error) };
  }
}

export async function doiVoucherAction(input: {
  siteId: string;
  code: string;
  requestKey: string;
}): Promise<
  | { ok: true; voucher: VoucherQuay | null; receipt: CounterSaleReceipt | null; message: string }
  | { ok: false; message: string }
> {
  const q = await nguoiQuay(input.siteId);
  if ("loi" in q) return { ok: false, message: q.loi ?? LOI_CHUNG };
  try {
    const kq = await doiVoucher({
      siteUuid: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[q.siteId],
      actorAccountId: q.user.id,
      actorName: q.user.name,
      actingDirectorAccountId: q.user.actingAs?.directorId ?? null,
      code: String(input.code ?? ""),
      requestKey: String(input.requestKey ?? ""),
    });
    revalidatePath(`/erp/${q.siteId}/ve-dat-cho`);
    return {
      ok: true,
      ...kq,
      message: kq.receipt
        ? `Đã đổi voucher: cấp vé miễn phí ${kq.receipt.saleCode}, nằm ở dòng vé mời của đối soát ca.`
        : "Đã đổi voucher. Trao quà lưu niệm cho khách.",
    };
  } catch (error) {
    return { ok: false, message: chuLoi(error) };
  }
}

/** Nhân viên gõ số hộ khách sau khi bán: gắn mọi mã vé của phiếu vào số ấy. */
export async function ganSoChoPhieuAction(input: {
  siteId: string;
  codes: string[];
  phone: string;
  marketing: boolean;
}): Promise<{ ok: true; tomTat: TomTatThanThiet; message: string } | { ok: false; message: string }> {
  const q = await nguoiQuay(input.siteId);
  if ("loi" in q) return { ok: false, message: q.loi ?? LOI_CHUNG };
  const codes = (Array.isArray(input.codes) ? input.codes : []).map((c) => String(c).trim().toUpperCase()).filter(laMaGanDuoc).slice(0, 4);
  if (codes.length === 0) return { ok: false, message: "Phiếu này không có mã vé để gắn." };
  try {
    const tomTat = await ganMaVaoSo({
      codes,
      phone: String(input.phone ?? ""),
      marketing: input.marketing === true,
      kenh: "erp",
      actorAccountId: q.user.id,
    });
    const goi = tomTat.linked ? `•••${tomTat.contactHint}, ${tomTat.visits} lượt đã đi` : "";
    return { ok: true, tomTat, message: `Đã gắn vé vào số ${goi}.` };
  } catch (error) {
    return { ok: false, message: chuLoi(error) };
  }
}
