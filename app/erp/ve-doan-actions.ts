"use server";

import { revalidatePath } from "next/cache";
import { isErpSiteId } from "@/domain/erp";
import {
  COUNTER_COMP_MAX,
  COUNTER_GROUP_MIN,
  COUNTER_SALE_MAX_PARTY,
  giaVeDoan,
  type CounterSaleReceipt,
  type TravelCompanyHistoryRow,
  type TravelCompanyStanding,
} from "@/domain/erp-counter-sale";
import {
  CounterSaleRepositoryError,
  createCounterCompSale,
  createCounterGroupSale,
  createTravelCompany,
  getCounterSaleWorkspace,
  listTravelCompanies,
  setTravelCompanyDiscount,
  travelCompanyHistory,
} from "@/lib/erp/counter-sale-repository";
import { accountCanAccessModule, getCurrentErpUser } from "@/lib/erp/demo-session";
import { niemPhieuQuay, PHUT_GIU_CHO_QUAY, PhieuQuayError } from "@/lib/erp/phieu-quay";
import { absoluteUrl } from "@/lib/site-url";
import { getVisitorGroupStatus } from "@/lib/customer-data/visitor-group-repository";
import type { VisitorGroupStatus } from "@/domain/visitor-group";

/**
 * Vé đoàn trả tiền ở quầy, vé mời và công ty lữ hành (12/10/2026, migration
 * 118). Lớp này chỉ kiểm quyền sớm để trả lời đúng chữ; giá, ưu đãi và quyền
 * thật nằm trong kho.
 */

type KetQuaPhieu = { ok: true; receipt: CounterSaleReceipt; message: string } | { ok: false; message: string };

const LOI_CHUNG = "Chưa lưu được phiếu. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.";

async function nguoiBan(siteId: string) {
  const user = await getCurrentErpUser();
  if (!user) return { loi: "Phiên đăng nhập đã hết hạn." } as const;
  if (!isErpSiteId(siteId)) return { loi: "Cơ sở không hợp lệ." } as const;
  if (!accountCanAccessModule(user, siteId, "ve-dat-cho")) {
    return { loi: "Tài khoản này chưa được phân công bán vé tại cơ sở này." } as const;
  }
  return { user, siteId } as const;
}

export type ThongTinDoan = {
  partySize: number;
  leaderName: string;
  leaderPhone: string;
  travelCompanyId: string | null;
  invoiceRequested: boolean;
  groupLabel: string;
};

function chuanDoan(input: ThongTinDoan) {
  const partySize = Math.trunc(Number(input.partySize));
  const leaderName = String(input.leaderName ?? "").trim().replace(/\s+/g, " ");
  const leaderPhone = String(input.leaderPhone ?? "").replace(/\s+/g, "");
  const travelCompanyId = input.travelCompanyId ? String(input.travelCompanyId) : null;
  const invoiceRequested = input.invoiceRequested === true;
  const groupLabel = String(input.groupLabel ?? "").trim().slice(0, 120);
  if (!(partySize >= COUNTER_GROUP_MIN && partySize <= COUNTER_SALE_MAX_PARTY)) {
    return { loi: `Vé đoàn từ ${COUNTER_GROUP_MIN} đến ${COUNTER_SALE_MAX_PARTY} người.` } as const;
  }
  if (leaderName.length < 2) return { loi: "Ghi tên trưởng đoàn hoặc hướng dẫn viên." } as const;
  if (leaderPhone && !/^\+?[0-9]{8,15}$/.test(leaderPhone)) {
    return { loi: "Số điện thoại trưởng đoàn chỉ gồm chữ số, 8 đến 15 số." } as const;
  }
  if (invoiceRequested && !travelCompanyId) return { loi: "Muốn xuất hoá đơn thì chọn công ty trước." } as const;
  return {
    doan: { partySize, leaderName, leaderPhone: leaderPhone || null, travelCompanyId, invoiceRequested, groupLabel },
  } as const;
}

/** Đoàn trả tiền mặt ngay tại quầy. */
export async function banVeDoanTienMatAction(
  input: ThongTinDoan & { siteId: string; cashReceivedVnd: number; cashCountedConfirmed: boolean; requestKey: string },
): Promise<KetQuaPhieu> {
  const ban = await nguoiBan(input.siteId);
  if ("loi" in ban) return { ok: false, message: ban.loi ?? LOI_CHUNG };
  const chuan = chuanDoan(input);
  if ("loi" in chuan) return { ok: false, message: chuan.loi ?? LOI_CHUNG };
  if (input.cashCountedConfirmed !== true) {
    return { ok: false, message: "Chưa đánh dấu đã đếm tiền và bỏ vào quỹ, nên phiếu chưa được lưu." };
  }
  try {
    const receipt = await createCounterGroupSale({
      siteId: ban.siteId,
      actorAccountId: ban.user.id,
      actorName: ban.user.name,
      actingDirectorAccountId: ban.user.actingAs?.directorId ?? null,
      ...chuan.doan,
      paymentMethod: "cash",
      cashReceivedVnd: Math.trunc(Number(input.cashReceivedVnd)),
      paymentReference: null,
      cashCountedConfirmed: true,
      requestKey: String(input.requestKey ?? ""),
    });
    revalidatePath(`/erp/${ban.siteId}/ve-dat-cho`);
    return { ok: true, receipt, message: `Đã lưu phiếu đoàn ${receipt.saleCode}. Đưa mã đoàn cho trưởng đoàn.` };
  } catch (error) {
    return { ok: false, message: error instanceof CounterSaleRepositoryError ? error.message : LOI_CHUNG };
  }
}

export type MaDoanKhachQuet =
  | { ok: true; url: string; manKhachUrl: string; expiresAt: number; totalVnd: number; discountPercent: number }
  | { ok: false; message: string };

/**
 * Đoàn trả bằng QR: chưa ghi gì, chỉ niêm thông tin đoàn vào mã. Khách quét ở
 * `/ve-quay/<mã>` thì phiếu đoàn mới được ghi, dưới tên người bán này.
 */
export async function taoMaDoanKhachQuetAction(
  input: ThongTinDoan & { siteId: string; requestKey: string },
): Promise<MaDoanKhachQuet> {
  const ban = await nguoiBan(input.siteId);
  if ("loi" in ban) return { ok: false, message: ban.loi ?? LOI_CHUNG };
  const chuan = chuanDoan(input);
  if ("loi" in chuan) return { ok: false, message: chuan.loi ?? LOI_CHUNG };
  const requestKey = String(input.requestKey ?? "");
  if (requestKey.length < 8) return { ok: false, message: "Phiếu chưa hợp lệ, xin tải lại trang." };
  const [workspace, congTy] = await Promise.all([
    getCounterSaleWorkspace({ siteId: ban.siteId, viewerAccountId: ban.user.id }),
    chuan.doan.travelCompanyId ? listTravelCompanies() : Promise.resolve([]),
  ]);
  if (!workspace.available) return { ok: false, message: workspace.message };
  const giaNguoiLon = workspace.prices.find((price) => price.product === "adult");
  if (!giaNguoiLon) return { ok: false, message: "Quầy chưa có giá người lớn. Xin báo quản lý." };
  const cty = congTy.find((item) => item.id === chuan.doan.travelCompanyId) ?? null;
  if (chuan.doan.travelCompanyId && !cty) return { ok: false, message: "Không tìm thấy công ty lữ hành này. Xin tải lại trang." };
  const gia = giaVeDoan({
    unitPriceVnd: giaNguoiLon.unitPriceVnd,
    partySize: chuan.doan.partySize,
    discountPercent: cty?.discountPercent ?? 0,
  });
  try {
    const expiresAt = Date.now() + PHUT_GIU_CHO_QUAY * 60_000;
    const ma = niemPhieuQuay({
      loai: "cho",
      siteId: ban.siteId,
      adults: chuan.doan.partySize,
      children: 0,
      actorAccountId: ban.user.id,
      actorName: ban.user.name,
      actingDirectorAccountId: ban.user.actingAs?.directorId ?? null,
      requestKey,
      totalVnd: gia.tongVnd,
      expiresAt,
      doan: {
        leaderName: chuan.doan.leaderName,
        leaderPhone: chuan.doan.leaderPhone,
        travelCompanyId: chuan.doan.travelCompanyId,
        invoiceRequested: chuan.doan.invoiceRequested,
        groupLabel: chuan.doan.groupLabel,
        companyName: cty?.name ?? null,
        discountPercent: gia.phanTram,
      },
    });
    return {
      ok: true,
      url: absoluteUrl(`/ve-quay/${ma}`),
      manKhachUrl: absoluteUrl(`/man-khach/${ma}`),
      expiresAt,
      totalVnd: gia.tongVnd,
      discountPercent: gia.phanTram,
    };
  } catch (error) {
    if (error instanceof PhieuQuayError) return { ok: false, message: error.message };
    return { ok: false, message: "Chưa tạo được mã cho khách quét. Xin thử lại." };
  }
}

/** Vé mời 0 đ: ghi người mời (tài khoản trong sổ) và lý do. */
export async function capVeMoiAction(input: {
  siteId: string;
  adults: number;
  children: number;
  inviterAccountId: string;
  reason: string;
  requestKey: string;
}): Promise<KetQuaPhieu> {
  const ban = await nguoiBan(input.siteId);
  if ("loi" in ban) return { ok: false, message: ban.loi ?? LOI_CHUNG };
  const adults = Math.trunc(Number(input.adults));
  const children = Math.trunc(Number(input.children));
  const reason = String(input.reason ?? "").trim();
  if (!(adults >= 0 && children >= 0 && adults + children >= 1 && adults + children <= COUNTER_COMP_MAX)) {
    return { ok: false, message: `Vé mời từ 1 đến ${COUNTER_COMP_MAX} khách một phiếu.` };
  }
  if (!input.inviterAccountId) return { ok: false, message: "Chọn người mời." };
  if (reason.length < 5) return { ok: false, message: "Ghi lý do mời, ít nhất năm ký tự." };
  try {
    const receipt = await createCounterCompSale({
      siteId: ban.siteId,
      actorAccountId: ban.user.id,
      actorName: ban.user.name,
      actingDirectorAccountId: ban.user.actingAs?.directorId ?? null,
      adults,
      children,
      inviterAccountId: String(input.inviterAccountId),
      reason,
      requestKey: String(input.requestKey ?? ""),
    });
    revalidatePath(`/erp/${ban.siteId}/ve-dat-cho`);
    return {
      ok: true,
      receipt,
      message: `Đã cấp vé mời ${receipt.saleCode}, người mời ${receipt.compInviterName ?? ""}. Không thu tiền.`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof CounterSaleRepositoryError ? error.message : LOI_CHUNG };
  }
}

export async function themCongTyAction(input: {
  siteId: string;
  name: string;
  taxCode: string;
  address: string;
  invoiceEmail: string;
  phone: string;
  contactName: string;
}): Promise<{ ok: true; company: TravelCompanyStanding } | { ok: false; message: string }> {
  const ban = await nguoiBan(input.siteId);
  if ("loi" in ban) return { ok: false, message: ban.loi ?? LOI_CHUNG };
  const name = String(input.name ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Ghi tên công ty." };
  try {
    const company = await createTravelCompany({
      siteId: ban.siteId,
      actorAccountId: ban.user.id,
      name,
      taxCode: String(input.taxCode ?? "").trim() || null,
      address: String(input.address ?? "").trim(),
      invoiceEmail: String(input.invoiceEmail ?? "").trim() || null,
      phone: String(input.phone ?? "").replace(/\s+/g, "") || null,
      contactName: String(input.contactName ?? "").trim(),
    });
    revalidatePath("/erp/cong-ty-lu-hanh");
    return { ok: true, company };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof CounterSaleRepositoryError ? error.message : "Chưa thêm được công ty. Xin thử lại.",
    };
  }
}

export async function datUuDaiRiengAction(input: {
  companyId: string;
  percent: number | null;
}): Promise<{ ok: true; company: TravelCompanyStanding } | { ok: false; message: string }> {
  const user = await getCurrentErpUser();
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (user.role !== "director") return { ok: false, message: "Chỉ giám đốc được đặt mức ưu đãi riêng cho công ty." };
  const percent = input.percent === null ? null : Math.trunc(Number(input.percent));
  if (percent !== null && !(percent >= 0 && percent <= 50)) {
    return { ok: false, message: "Mức ưu đãi riêng từ 0 đến 50%." };
  }
  try {
    const company = await setTravelCompanyDiscount({ actorAccountId: user.id, companyId: String(input.companyId), percent });
    revalidatePath("/erp/cong-ty-lu-hanh");
    return { ok: true, company };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof CounterSaleRepositoryError ? error.message : "Chưa lưu được mức ưu đãi. Xin thử lại.",
    };
  }
}

export async function lichSuCongTyAction(companyId: string): Promise<TravelCompanyHistoryRow[]> {
  const user = await getCurrentErpUser();
  if (!user || (user.role !== "director" && user.role !== "manager" && user.role !== "chief-accountant" && user.role !== "accountant")) {
    return [];
  }
  try {
    return await travelCompanyHistory(String(companyId));
  } catch {
    return [];
  }
}

/** Trạng thái đoàn vừa bán, để gắn tên từng người từ danh sách AI đã soát. */
export async function docDoanVuaBanAction(input: { siteId: string; groupCode: string }): Promise<VisitorGroupStatus | null> {
  const ban = await nguoiBan(input.siteId);
  if ("loi" in ban) return null;
  try {
    return await getVisitorGroupStatus(String(input.groupCode ?? ""));
  } catch {
    return null;
  }
}
