/**
 * Gợi ý kiểu ứng dụng lớn (13/10/2026, migration 127), không cần đăng nhập
 * hay mạng xã hội: (1) số thật nói với khách ("1.240 khách qua cổng Tràng An
 * 7 ngày qua"), (2) "khách giống bạn hay chọn" theo kiểu nhóm đi cùng, (3)
 * "bạn của bạn đã đi đây" qua đường dẫn chính khách tự chia sẻ.
 */

import type { LoaiNhom } from "@/domain/khach-thich-gi";

export type SoNoiBat = {
  /** Mã điểm (sites.slug) → lượt qua cổng 7 ngày qua. */
  diem: Record<string, number>;
  /** Mã gói → đơn web 30 ngày qua. */
  goi: Record<string, number>;
  /** Kiểu nhóm → tối đa 3 gói hay được chọn nhất (90 ngày). */
  theoNhom: Partial<Record<LoaiNhom, { slug: string; don: number; tong: number }[]>>;
};

/** Dưới mức này thì không nói số, tránh câu "2 khách đã đặt" nghe vắng hơn là không nói. */
export const SO_DU_DE_NOI = 20;

function soNguyen(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export function docSoNoiBat(raw: unknown): SoNoiBat {
  const r = (raw ?? {}) as Record<string, unknown>;
  const banDo = (v: unknown) =>
    Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).map(([k, n]) => [k, soNguyen(n)]));
  const theoNhom: SoNoiBat["theoNhom"] = {};
  for (const [loai, ds] of Object.entries((r.theo_nhom ?? {}) as Record<string, unknown>)) {
    if (!Array.isArray(ds)) continue;
    theoNhom[loai as LoaiNhom] = (ds as Record<string, unknown>[]).map((d) => ({
      slug: String(d.slug ?? ""),
      don: soNguyen(d.don),
      tong: soNguyen(d.tong),
    }));
  }
  return { diem: banDo(r.diem), goi: banDo(r.goi), theoNhom };
}

export function loaiNhom(nguoiLon: number, treEm: number): LoaiNhom {
  if (treEm > 0) return "gia-dinh-co-tre";
  if (nguoiLon <= 1) return "mot-minh";
  if (nguoiLon === 2) return "hai-nguoi";
  return "nhom-ban";
}

/**
 * Gói mà nhóm cùng kiểu hay chọn nhất, khi khác gói đang xem và đủ đơn để nói.
 * Chỉ gợi ý gói trong danh sách `choPhep` (gói đang bán).
 */
export function goiYChoNhom(
  so: SoNoiBat | null,
  loai: LoaiNhom,
  dangXem: string,
  choPhep: ReadonlySet<string>,
): { slug: string; phanTram: number } | null {
  const ds = so?.theoNhom[loai] ?? [];
  const dau = ds.find((d) => choPhep.has(d.slug));
  if (!dau || dau.slug === dangXem || dau.tong < SO_DU_DE_NOI) return null;
  const phanTram = Math.round((dau.don / Math.max(1, dau.tong)) * 100);
  return phanTram >= 20 ? { slug: dau.slug, phanTram } : null;
}

export const NHAN_NHOM: Record<LoaiNhom, { vi: string; en: string }> = {
  "gia-dinh-co-tre": { vi: "Gia đình có trẻ như bạn", en: "Families with children like yours" },
  "hai-nguoi": { vi: "Nhóm hai người như bạn", en: "Pairs like you" },
  "nhom-ban": { vi: "Nhóm bạn như bạn", en: "Groups like yours" },
  "mot-minh": { vi: "Khách đi một mình như bạn", en: "Solo travellers like you" },
};
