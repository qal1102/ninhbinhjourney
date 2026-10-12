import type { Metadata } from "next";
import { moPhieuQuay, PhieuQuayError } from "@/lib/erp/phieu-quay";
import { ch } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";
import { timPhieuCuaMa } from "../tim-phieu";
import { veTuPhieu, type VeQuayHienThi } from "../ve-tu-phieu";
import { TrangVeQuay } from "./trang-ve-quay";

export const metadata: Metadata = {
  title: "Vé của bạn · Ninh Bình Journey",
  robots: { index: false, follow: false },
};

/**
 * Trang mở ra trên điện thoại khách khi quét mã QR ở quầy vé (12/10/2026).
 *
 * Phiếu đã có thì hiện vé ngay. Chưa có mà mã còn hạn giữ chỗ thì trang tự
 * xác nhận trả (giả lập) từ phía trình duyệt, không phải ở bước dựng trang:
 * máy xem trước đường dẫn (Zalo, Messenger) mở trang này cũng không được ghi
 * phiếu bán thay khách.
 */
export default async function VeQuayPage({
  params,
  searchParams,
}: {
  params: Promise<{ phieu: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { phieu } = await params;
  const lang = await docNgonNgu(await searchParams);
  const ma = decodeURIComponent(phieu);
  let ve: VeQuayHienThi | null = null;
  let choXacNhan: { totalVnd: number; soKhach: number; expiresAt: number } | null = null;
  let loi = "";
  try {
    const mo = moPhieuQuay(ma, undefined, undefined, { choPhepHetHan: true });
    const receipt = await timPhieuCuaMa(mo);
    if (receipt) {
      ve = veTuPhieu(mo.siteId, receipt);
    } else if (mo.loai === "cho") {
      // Chưa trả: mở lại đúng luật thường, mã quá hạn thì báo hết hạn.
      moPhieuQuay(ma);
      choXacNhan = { totalVnd: mo.totalVnd, soKhach: mo.adults + mo.children, expiresAt: mo.expiresAt };
    } else {
      loi = ch(lang, "Không tìm thấy phiếu vé này.", "This ticket could not be found.");
    }
  } catch (error) {
    loi =
      error instanceof PhieuQuayError
        ? error.code === "PHIEU_HET_HAN"
          ? ch(lang, error.message, "This QR code has expired. Please ask the ticket desk for a new one.")
          : ch(lang, error.message, "This QR code cannot be read. Please scan the code at the ticket desk again.")
        : ch(lang, "Chưa đọc được vé. Mời bạn thử lại sau ít phút.", "Could not load the ticket. Please try again shortly.");
  }

  return (
    <main lang={lang} className="min-h-screen bg-[#eef2ef] px-4 py-8 text-[#151a17] sm:px-8 sm:py-14">
      <TrangVeQuay ma={ma} lang={lang} veBanDau={ve} choXacNhan={choXacNhan} loi={loi} />
    </main>
  );
}
