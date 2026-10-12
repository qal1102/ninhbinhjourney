import type { Metadata } from "next";
import { ERP_SITES } from "@/domain/erp";
import { moPhieuQuay, PhieuQuayError } from "@/lib/erp/phieu-quay";
import { absoluteUrl } from "@/lib/site-url";
import { ManKhach, type ThongTinManKhach } from "./man-khach";

export const metadata: Metadata = {
  title: "Mời quét mã · Ninh Bình Journey",
  robots: { index: false, follow: false },
};

/**
 * Màn hình thứ hai ở quầy, quay ra phía khách (12/10/2026, chủ dự án: "làm 1
 * màn hình khác hiển thị vé hiện tại cần thanh toán xong countdown time 15p").
 *
 * Chỉ hiện số tiền, mã QR và đồng hồ giữ chỗ. Vé KHÔNG hiện ở đây trước khi
 * khách quét: quét bằng điện thoại thì vé ra trên máy khách, màn này chỉ đổi
 * sang "Đã thanh toán". Nhờ vậy không ai tưởng chụp màn hình là vào cổng được.
 */
export default async function ManKhachPage({ params }: { params: Promise<{ ma: string }> }) {
  const { ma: maGoc } = await params;
  const ma = decodeURIComponent(maGoc);
  let thongTin: ThongTinManKhach | null = null;
  let loi = "";
  try {
    const phieu = moPhieuQuay(ma, undefined, undefined, { choPhepHetHan: true });
    if (phieu.loai !== "cho") {
      loi = "Mã này chỉ để xem lại vé, không dùng cho màn thanh toán.";
    } else {
      thongTin = {
        coSo: ERP_SITES.find((site) => site.id === phieu.siteId)?.name ?? "Ninh Bình",
        soKhach: phieu.adults + phieu.children,
        nguoiLon: phieu.adults,
        treEm: phieu.children,
        tongVnd: phieu.totalVnd,
        hetLuc: phieu.expiresAt,
        urlQuet: absoluteUrl(`/ve-quay/${ma}`),
        doan: phieu.doan
          ? {
              truongDoan: phieu.doan.leaderName,
              congTy: phieu.doan.companyName,
              uuDai: phieu.doan.discountPercent,
            }
          : null,
      };
    }
  } catch (error) {
    loi = error instanceof PhieuQuayError ? error.message : "Chưa đọc được mã thanh toán.";
  }

  return (
    <main className="min-h-screen bg-[#0f2c24] px-4 py-6 text-white sm:px-10 sm:py-10">
      <ManKhach ma={ma} thongTin={thongTin} loi={loi} />
    </main>
  );
}
