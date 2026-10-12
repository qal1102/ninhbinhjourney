import { congNgay, type NgayBaoCao } from "@/domain/bao-cao-co-so";

/**
 * Màn Toàn vùng (12/10/2026, chủ dự án: "quản lý thấy được toàn bộ báo cáo tài
 * chính…, báo cáo chi tiết từng vùng nếu click vào").
 *
 * Mọi con số khách và tiền ở đây cộng từ cùng một chuỗi ngày của màn Báo cáo
 * & dự báo từng cơ sở (`erp_bao_cao_co_so`), nên cộng bốn cơ sở lại luôn ra
 * đúng tổng, và mở từng cơ sở ra không bao giờ thấy một con số khác.
 */

export const KY_TOAN_VUNG = ["hom-nay", "7-ngay", "30-ngay"] as const;
export type KyToanVung = (typeof KY_TOAN_VUNG)[number];

export const TEN_KY: Readonly<Record<KyToanVung, string>> = {
  "hom-nay": "Hôm nay",
  "7-ngay": "7 ngày",
  "30-ngay": "30 ngày",
};

const SO_NGAY: Readonly<Record<KyToanVung, number>> = { "hom-nay": 1, "7-ngay": 7, "30-ngay": 30 };

/** Số ngày cần đọc để có cả kỳ dài nhất lẫn kỳ liền trước nó. */
export const SO_NGAY_CAN_DOC = SO_NGAY["30-ngay"] * 2;

export function docKy(value: string | undefined): KyToanVung {
  return KY_TOAN_VUNG.includes(value as KyToanVung) ? (value as KyToanVung) : "hom-nay";
}

export type TongKy = {
  khach: number;
  tienQuay: number;
  phieuQuay: number;
  tienWeb: number;
  khachWeb: number;
};

export const TONG_RONG: TongKy = { khach: 0, tienQuay: 0, phieuQuay: 0, tienWeb: 0, khachWeb: 0 };

export function tienCua(tong: TongKy) {
  return tong.tienQuay + tong.tienWeb;
}

function cong(ngay: readonly NgayBaoCao[], tu: string, den: string): TongKy {
  return ngay
    .filter((hang) => hang.ngay >= tu && hang.ngay <= den)
    .reduce<TongKy>(
      (tong, hang) => ({
        khach: tong.khach + hang.khachVao,
        tienQuay: tong.tienQuay + hang.tienQuay,
        phieuQuay: tong.phieuQuay + hang.phieuQuay,
        tienWeb: tong.tienWeb + hang.tienWeb,
        khachWeb: tong.khachWeb + hang.khachWeb,
      }),
      TONG_RONG,
    );
}

/**
 * Kỳ đang xem và kỳ liền trước cùng độ dài. "Hôm nay" so với hôm qua; ngày
 * hôm nay chưa hết nên con số so sánh chỉ để thấy chiều, không để kết luận.
 */
export function tongTheoKy(ngay: readonly NgayBaoCao[], ky: KyToanVung, homNay: string) {
  const soNgay = SO_NGAY[ky];
  const tu = congNgay(homNay, -(soNgay - 1));
  return {
    hienTai: cong(ngay, tu, homNay),
    truoc: cong(ngay, congNgay(tu, -soNgay), congNgay(tu, -1)),
  };
}

export function cacNgayTrongKy(ngay: readonly NgayBaoCao[], ky: KyToanVung, homNay: string) {
  // Hôm nay chỉ có một cột, nên biểu đồ của kỳ ấy kéo về 14 ngày cho có hình.
  const soNgay = ky === "hom-nay" ? 14 : SO_NGAY[ky];
  const tu = congNgay(homNay, -(soNgay - 1));
  return ngay.filter((hang) => hang.ngay >= tu && hang.ngay <= homNay);
}

/** null khi kỳ trước bằng 0: chia cho không thì phần trăm không có nghĩa. */
export function phanTramDoi(hienTai: number, truoc: number): number | null {
  if (truoc <= 0) return null;
  return Math.round(((hienTai - truoc) / truoc) * 100);
}

export function tiTrong(phan: number, tong: number) {
  return tong > 0 ? Math.round((phan / tong) * 100) : 0;
}
