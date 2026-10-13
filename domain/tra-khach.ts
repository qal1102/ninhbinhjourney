/**
 * ERP tra khách (13/10/2026, migration 130): nhân viên gõ số điện thoại hoặc
 * bất kỳ mã nào (NBJ-, WEB-, QUAY-, TV-, PT-) và thấy một hồ sơ nối mọi thứ:
 * đơn web, vé quầy đã gắn số, lượt qua cổng, điểm, quà, mã mời, sự kiện, ảnh.
 */

export type LanQuet = { luc: string; ketQua: string; nguoi: string };

export type VeTraKhach = {
  code: string;
  site: string;
  channel: string;
  product: string;
  validOn: string;
  status: string;
  entriesAllowed: number;
  entriesUsed: number;
  issuedAt: string;
  saleCode: string | null;
  lanQuet: LanQuet[];
};

export type DonTraKhach = {
  orderCode: string;
  product: string;
  visitDate: string;
  adults: number;
  children: number;
  totalVnd: number;
  giamVnd: number;
  maMoi: string | null;
  status: string;
  createdAt: string;
  ve: VeTraKhach[];
};

export type KetQuaTraKhach =
  | { timThay: false }
  | {
      timThay: true;
      coSo: boolean;
      so: string | null;
      tiepThi: string | null;
      donWeb: DonTraKhach[];
      veKhac: VeTraKhach[];
      tichDiem: {
        visits: number;
        points: number;
        referralCode: string;
        referrals: number;
        nextMilestone: { visits: number; reward: string; remaining: number } | null;
        vouchers: { code: string; label: string; status: string; expiresOn: string }[];
      } | null;
      suKien: { ten: string; slug: string; ma: string; trung: number | null; maNhan: string | null }[];
      thiAnh: { thang: string; trangThai: string; giai: string | null; maNhan: string | null }[];
    };

function chu(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function so(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function mang(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

function docVe(v: Record<string, unknown>): VeTraKhach {
  return {
    code: chu(v.code),
    site: chu(v.site),
    channel: chu(v.channel),
    product: chu(v.product),
    validOn: chu(v.valid_on),
    status: chu(v.status),
    entriesAllowed: so(v.entries_allowed),
    entriesUsed: so(v.entries_used),
    issuedAt: chu(v.issued_at),
    saleCode: typeof v.sale_code === "string" ? v.sale_code : null,
    lanQuet: mang(v.lan_quet).map((q) => ({ luc: chu(q.luc), ketQua: chu(q.ket_qua), nguoi: chu(q.nguoi) })),
  };
}

export function docKetQuaTraKhach(raw: unknown): KetQuaTraKhach {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.tim_thay !== true) return { timThay: false };
  const td = r.tich_diem as Record<string, unknown> | null | undefined;
  const ke = td?.next_milestone as Record<string, unknown> | null | undefined;
  return {
    timThay: true,
    coSo: r.co_so === true,
    so: typeof r.so === "string" ? r.so : null,
    tiepThi: typeof r.tiep_thi === "string" ? r.tiep_thi : null,
    donWeb: mang(r.don_web).map((d) => ({
      orderCode: chu(d.order_code),
      product: chu(d.product),
      visitDate: chu(d.visit_date),
      adults: so(d.adults),
      children: so(d.children),
      totalVnd: so(d.total_vnd),
      giamVnd: so(d.giam_vnd),
      maMoi: typeof d.ma_moi === "string" ? d.ma_moi : null,
      status: chu(d.status),
      createdAt: chu(d.created_at),
      ve: mang(d.ve).map(docVe),
    })),
    veKhac: mang(r.ve_khac).map(docVe),
    tichDiem: td
      ? {
          visits: so(td.visits),
          points: so(td.points),
          referralCode: chu(td.referral_code),
          referrals: so(td.referrals),
          nextMilestone: ke ? { visits: so(ke.visits), reward: chu(ke.reward), remaining: so(ke.remaining) } : null,
          vouchers: mang(td.vouchers).map((v) => ({ code: chu(v.code), label: chu(v.label), status: chu(v.status), expiresOn: chu(v.expires_on) })),
        }
      : null,
    suKien: mang(r.su_kien).map((s) => ({ ten: chu(s.ten), slug: chu(s.slug), ma: chu(s.ma), trung: s.trung == null ? null : so(s.trung), maNhan: typeof s.ma_nhan === "string" ? s.ma_nhan : null })),
    thiAnh: mang(r.thi_anh).map((a) => ({ thang: chu(a.thang), trangThai: chu(a.trang_thai), giai: typeof a.giai === "string" ? a.giai : null, maNhan: typeof a.ma_nhan === "string" ? a.ma_nhan : null })),
  };
}

/** Ô nhập là số điện thoại Việt Nam (10–11 số, có thể +84) hay là mã. */
export function laSoDienThoai(nhap: string): string | null {
  const gon = nhap.trim().replace(/[\s.+-]/g, "").replace(/^84/, "0");
  return /^0\d{9,10}$/.test(gon) ? gon : null;
}

/** Mã đủ khuôn để tra: NBJ-, WEB-, QUAY-, TV-, PT-, DOAN-. */
export function laMaTraDuoc(nhap: string): string | null {
  const gon = nhap.trim().toUpperCase().replace(/\s+/g, "");
  return /^(NBJ|WEB|QUAY|TV|PT|DOAN)-[A-Z0-9-]{4,40}$/.test(gon) ? gon : null;
}
