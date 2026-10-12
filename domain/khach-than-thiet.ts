/**
 * Khách thân thiết (12/10/2026, migration 119): vé đoàn thành vé cá nhân bằng
 * số điện thoại, tích lượt đi, quà và voucher. Mốc thưởng nằm trong kho
 * (`customer_loyalty_milestones`); phần này chỉ đọc kết quả kho trả về.
 */

export type MocKe = { visits: number; reward: string; remaining: number };

export type VoucherKhach = {
  code: string;
  kind: "qua-luu-niem" | "ve-mien-phi";
  label: string;
  milestone: number;
  status: "issued" | "redeemed";
  expiresOn: string;
  redeemedAt: string | null;
};

export type VeDaGan = {
  code: string;
  kind: "group-member" | "ticket";
  site: string;
  validOn: string;
  status: string;
  entriesAllowed: number;
  entriesUsed: number;
};

export type TomTatThanThiet =
  | { linked: false }
  | {
      linked: true;
      contactHint: string;
      visits: number;
      points: number;
      nextMilestone: MocKe | null;
      voucherCount: number;
      visitList: { site: string; date: string }[];
      /** Chỉ có khi khách nhập lại đúng số điện thoại. */
      vouchers: VoucherKhach[] | null;
      tickets: VeDaGan[] | null;
      marketingStatus?: "granted" | "denied" | "revoked";
    };

/** Các mốc thưởng, khớp `customer_loyalty_milestones` của migration 119. */
export const MOC_THUONG = [
  { visits: 2, reward: "Quà lưu niệm" },
  { visits: 4, reward: "Một vé người lớn miễn phí" },
  { visits: 8, reward: "Một vé người lớn miễn phí" },
] as const;

export const DIEM_MOI_LUOT = 100;

function soNguyen(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function chu(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function docTomTat(raw: unknown): TomTatThanThiet {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.linked !== true) return { linked: false };
  const ke = r.next_milestone as Record<string, unknown> | null | undefined;
  const vouchers = Array.isArray(r.vouchers)
    ? (r.vouchers as Record<string, unknown>[]).map((v) => ({
        code: chu(v.code),
        kind: v.kind === "ve-mien-phi" ? ("ve-mien-phi" as const) : ("qua-luu-niem" as const),
        label: chu(v.label),
        milestone: soNguyen(v.milestone),
        status: v.status === "redeemed" ? ("redeemed" as const) : ("issued" as const),
        expiresOn: chu(v.expires_on),
        redeemedAt: v.redeemed_at ? chu(v.redeemed_at) : null,
      }))
    : null;
  const tickets = Array.isArray(r.tickets)
    ? (r.tickets as Record<string, unknown>[]).map((t) => ({
        code: chu(t.code),
        kind: t.kind === "group-member" ? ("group-member" as const) : ("ticket" as const),
        site: chu(t.site),
        validOn: chu(t.valid_on),
        status: chu(t.status),
        entriesAllowed: soNguyen(t.entries_allowed),
        entriesUsed: soNguyen(t.entries_used),
      }))
    : null;
  const tiepThi = r.marketing_status;
  return {
    linked: true,
    contactHint: chu(r.contact_hint),
    visits: soNguyen(r.visits),
    points: soNguyen(r.points),
    nextMilestone: ke ? { visits: soNguyen(ke.visits), reward: chu(ke.reward), remaining: soNguyen(ke.remaining) } : null,
    voucherCount: soNguyen(r.voucher_count),
    visitList: Array.isArray(r.visit_list)
      ? (r.visit_list as Record<string, unknown>[]).map((v) => ({ site: chu(v.site), date: chu(v.date) }))
      : [],
    vouchers,
    tickets,
    ...(tiepThi === "granted" || tiepThi === "denied" || tiepThi === "revoked" ? { marketingStatus: tiepThi } : {}),
  };
}

export type VoucherQuay = {
  code: string;
  kind: "qua-luu-niem" | "ve-mien-phi";
  label: string;
  status: "issued" | "redeemed";
  expiresOn: string;
  expired: boolean;
  redeemedAt: string | null;
  redeemedByName: string | null;
  redeemedSaleCode: string | null;
  contactHint: string;
  visits: number;
};

export function docVoucherQuay(raw: unknown): VoucherQuay | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (!v.code) return null;
  return {
    code: chu(v.code),
    kind: v.kind === "ve-mien-phi" ? "ve-mien-phi" : "qua-luu-niem",
    label: chu(v.label),
    status: v.status === "redeemed" ? "redeemed" : "issued",
    expiresOn: chu(v.expires_on),
    expired: v.expired === true,
    redeemedAt: v.redeemed_at ? chu(v.redeemed_at) : null,
    redeemedByName: v.redeemed_by_name ? chu(v.redeemed_by_name) : null,
    redeemedSaleCode: v.redeemed_sale_code ? chu(v.redeemed_sale_code) : null,
    contactHint: chu(v.contact_hint),
    visits: soNguyen(v.visits),
  };
}

export type TongQuanThanThiet = {
  customers: number;
  links: number;
  fromGroups: number;
  marketingGranted: number;
  vouchersIssued: number;
  vouchersRedeemed: number;
  top: {
    contactHint: string;
    visits: number;
    codes: number;
    marketing: string;
    vouchers: number;
    vouchersOpen: number;
    lastLinkedAt: string;
  }[];
};

export function docTongQuan(raw: unknown): TongQuanThanThiet {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    customers: soNguyen(r.customers),
    links: soNguyen(r.links),
    fromGroups: soNguyen(r.from_groups),
    marketingGranted: soNguyen(r.marketing_granted),
    vouchersIssued: soNguyen(r.vouchers_issued),
    vouchersRedeemed: soNguyen(r.vouchers_redeemed),
    top: Array.isArray(r.top)
      ? (r.top as Record<string, unknown>[]).map((t) => ({
          contactHint: chu(t.contact_hint),
          visits: soNguyen(t.visits),
          codes: soNguyen(t.codes),
          marketing: chu(t.marketing),
          vouchers: soNguyen(t.vouchers),
          vouchersOpen: soNguyen(t.vouchers_open),
          lastLinkedAt: chu(t.last_linked_at),
        }))
      : [],
  };
}

/** Mã khách cầm: mã người trong đoàn `TV-…` hoặc mã vé `QUAY-…`, `WEB-…`. */
export function laMaGanDuoc(code: string) {
  return /^(TV-[A-Z0-9]{10}|[A-Z]{2,6}-[A-Z0-9-]{6,32})$/.test(code.trim().toUpperCase());
}

/** Số điện thoại Việt Nam 10 số (đầu 0, hoặc +84/84). Trả số đã chuẩn hoá, sai thì null. */
export function chuanSoDienThoai(raw: string): string | null {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  const so = compact.startsWith("+84") ? `0${compact.slice(3)}` : compact.startsWith("84") ? `0${compact.slice(2)}` : compact;
  return /^0\d{9}$/.test(so) ? so : null;
}
