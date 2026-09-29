import type { Metadata } from "next";
import Link from "next/link";
import { TrangQuetThanhToan, type KetQuaDaTra } from "@/components/commerce/trang-quet-thanh-toan";
import { PACKAGES } from "@/content/packages";
import { docKetQuaQr, isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { moPhieu, PhieuQrError } from "@/lib/customer-data/phieu-qr-thanh-toan";

export const metadata: Metadata = {
  title: "Thanh toán bằng mã QR · Ninh Bình Journey",
  robots: { index: false, follow: false },
};

// Trang mở ra trên điện thoại vừa quét mã QR ở màn hình đặt chỗ. Chỉ ĐỌC
// phiếu để hiện số tiền (hay vé, nếu đã trả); chưa ghi gì cho tới khi khách
// bấm xác nhận.
export default async function TrangThanhToanQr({
  params,
}: {
  params: Promise<{ phieu: string }>;
}) {
  const { phieu } = await params;
  let loi = "";
  let thongTin: {
    amountVnd: number;
    productName: string;
    expiresAt: number;
    ketQuaBanDau: KetQuaDaTra | null;
  } | null = null;
  if (!isCustomerBookingEnabled()) {
    loi = "Đặt chỗ trên web đang tạm đóng, nên mã QR này chưa dùng được ạ.";
  } else {
    try {
      // Mở cả phiếu đã quá hạn, vì chỉ để hỏi "trả chưa?". Khách quét lại mã
      // sau khi đã trả thì thấy ngay vé, không thấy đồng hồ đếm ngược hay câu
      // "mã hết hạn" (chủ dự án gặp 29/09/2026).
      const mo = moPhieu(decodeURIComponent(phieu), undefined, undefined, { choPhepHetHan: true });
      const daTra = await docKetQuaQr({
        holdId: mo.holdId,
        paymentRequestId: mo.paymentRequestId,
        anonymousId: mo.anonymousId,
      }).catch((error) => {
        console.error("Đọc trạng thái phiếu QR không thành", error);
        return null;
      });
      // Chưa trả thì mở lại đúng luật thường: phiếu quá hạn báo hết hạn.
      if (!daTra) moPhieu(decodeURIComponent(phieu));
      thongTin = {
        amountVnd: mo.amountVnd,
        productName: PACKAGES.find((item) => item.id === mo.productId)?.name ?? "Gói tham quan Ninh Bình",
        expiresAt: mo.expiresAt,
        ketQuaBanDau: daTra ? { orderCode: daTra.orderCode, tickets: daTra.tickets } : null,
      };
    } catch (error) {
      loi = error instanceof PhieuQrError ? error.message : "Mã QR này không đọc được.";
    }
  }

  return (
    <main className="min-h-screen bg-[#eef2ef] px-4 py-8 text-[#151a17] sm:px-8 sm:py-14">
      {thongTin ? (
        <TrangQuetThanhToan phieu={decodeURIComponent(phieu)} {...thongTin} />
      ) : (
        <div className="mx-auto max-w-md rounded-3xl border border-[#d7d5cd] bg-white p-7 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9a6328]">Ninh Bình Journey</p>
          <h1 className="font-display mt-3 text-3xl text-[#183f34]">Mã QR chưa dùng được</h1>
          <p className="mt-4 leading-7 text-[#59654b]">{loi}</p>
          <Link
            href="/packages"
            className="mt-6 inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
          >
            Xem các gói tham quan
          </Link>
        </div>
      )}
    </main>
  );
}
