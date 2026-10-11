import { mucDoDong, type MucDoDong } from "@/domain/customer-booking";

/**
 * Dự báo độ đông theo ngày đi (H1, chủ dự án duyệt 11/10/2026; học Google
 * "Popular times"). Không có mô hình nào: lấy lượt qua cổng thật của những
 * ngày cùng thứ trong 8 tuần trước, cộng trung bình theo giờ. Ít hơn
 * `NGAY_TOI_THIEU` ngày có số thì không dự báo, để trang nói thật là chưa đủ.
 */
export const SO_TUAN_NHIN_LAI = 8;
export const NGAY_TOI_THIEU = 2;
/**
 * Giờ được gợi ý là "thong thả nhất": từ 7 giờ tới 15 giờ. Giờ cuối ngày luôn
 * vắng vì cổng sắp đóng, gợi khách tới lúc ấy là gợi một chuyến vội.
 */
export const GIO_GOI_Y = { tu: 7, den: 15 } as const;

export type DuBaoDoDong = {
  ngayDi: string;
  /** Trung bình lượt mỗi ô giờ, cùng thứ tự với giờ truyền vào. */
  theoGio: number[];
  mucTheoGio: MucDoDong[];
  /** Số ngày cùng thứ có lượt qua cổng, dùng để chia trung bình. */
  soNgay: number;
  dinh: number | null;
  vangNhat: number | null;
};

/** Các ngày cùng thứ trước `ngayDi`, chỉ lấy ngày đã qua so với `homNay`. */
export function ngayCungThuTruoc(ngayDi: string, homNay: string, soTuan = SO_TUAN_NHIN_LAI): string[] {
  const goc = Date.parse(`${ngayDi}T00:00:00Z`);
  const ra: string[] = [];
  for (let k = 1; ra.length < soTuan && k <= soTuan + 3; k++) {
    const ngay = new Date(goc - k * 7 * 86_400_000).toISOString().slice(0, 10);
    if (ngay < homNay) ra.push(ngay);
  }
  return ra;
}

export function duBaoTuCacNgay(ngayDi: string, gio: readonly number[], cacNgay: number[][]): DuBaoDoDong | null {
  const coSo = cacNgay.filter((ngay) => ngay.some((n) => n > 0));
  if (coSo.length < NGAY_TOI_THIEU) return null;
  const theoGio = gio.map((_, i) => Math.round(coSo.reduce((tong, ngay) => tong + (ngay[i] ?? 0), 0) / coSo.length));
  const cao = Math.max(...theoGio);
  const mucTheoGio = theoGio.map((n) => mucDoDong(cao > 0 ? n / cao : 0));
  const oDinh = cao > 0 ? theoGio.indexOf(cao) : -1;
  // Giờ vắng nhất chỉ tính trong những giờ thường có khách và còn kịp đi trọn.
  let oVang = -1;
  theoGio.forEach((n, i) => {
    if (gio[i] < GIO_GOI_Y.tu || gio[i] > GIO_GOI_Y.den) return;
    if (n > 0 && (oVang < 0 || n < theoGio[oVang])) oVang = i;
  });
  const dinh = oDinh >= 0 ? gio[oDinh] : null;
  const vangNhat = oVang >= 0 && oVang !== oDinh ? gio[oVang] : null;
  return { ngayDi, theoGio, mucTheoGio, soNgay: coSo.length, dinh, vangNhat };
}
