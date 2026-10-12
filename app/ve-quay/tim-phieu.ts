import "server-only";

import { counterPaymentReference, type CounterSaleReceipt } from "@/domain/erp-counter-sale";
import { findCounterSale, ngayBanVietNam } from "@/lib/erp/counter-sale-repository";
import { PHUT_GIU_CHO_QUAY, type PhieuQuay } from "@/lib/erp/phieu-quay";

/**
 * Phiếu bán ứng với một mã QR quầy, nếu đã có. Mã chờ quét tìm theo nội dung
 * chuyển khoản sinh từ khoá phiếu, trong ngày tạo mã và ngày hôm nay (mã tạo
 * lúc 23:58 có thể được quét sau nửa đêm).
 */
export async function timPhieuCuaMa(phieu: PhieuQuay): Promise<CounterSaleReceipt | null> {
  if (phieu.loai === "ve") {
    return findCounterSale({
      siteId: phieu.siteId,
      viewerAccountId: phieu.viewerAccountId,
      businessDate: phieu.businessDate,
      saleCode: phieu.saleCode,
    });
  }
  const ngay = [...new Set([ngayBanVietNam(phieu.expiresAt - PHUT_GIU_CHO_QUAY * 60_000), ngayBanVietNam(Date.now())])];
  for (const businessDate of ngay) {
    const receipt = await findCounterSale({
      siteId: phieu.siteId,
      viewerAccountId: phieu.actorAccountId,
      businessDate,
      paymentReference: counterPaymentReference(phieu.requestKey),
    });
    if (receipt) return receipt;
  }
  return null;
}
