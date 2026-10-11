/**
 * Một mã cho cả ngày (H6, 11/10/2026). Mã đơn `NBJ-` cộng 12 ký tự quét ở
 * cổng thì đổi sang vé nào của đơn: đúng cơ sở trước, rồi đúng ngày, rồi vé
 * còn lượt, rồi vé còn nhiều lượt nhất.
 */
export type VeCuaDon = {
  ticket_code: string;
  site_id: string;
  valid_on: string;
  entries_allowed: number;
  entries_used: number;
  status: string;
};

/** Mã quét được (có thể là cả đường dẫn) là mã đơn thì trả mã đơn, không thì `null`. */
export function laMaDon(raw: string): string | null {
  const ma = raw.trim().toUpperCase().split("?")[0].split("#")[0].replace(/\/+$/, "").replace(/^.*\//, "");
  return /^NBJ-[A-Z0-9]{12}$/.test(ma) ? ma : null;
}

export function chonVeChoMaDon(ve: readonly VeCuaDon[], coSo: string, homNay: string): VeCuaDon | null {
  const diem = (v: VeCuaDon) => [
    v.site_id === coSo ? 0 : 1,
    v.valid_on === homNay ? 0 : 1,
    (v.status === "issued" || v.status === "partially-used") && v.entries_used < v.entries_allowed ? 0 : 1,
    -(v.entries_allowed - v.entries_used),
  ];
  const xep = [...ve].sort((a, b) => {
    const da = diem(a);
    const db = diem(b);
    for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) return da[i] - db[i];
    return a.ticket_code.localeCompare(b.ticket_code);
  });
  return xep[0] ?? null;
}
