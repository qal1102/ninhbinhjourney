"use server";

import { counterPaymentReference } from "@/domain/erp-counter-sale";
import { CounterSaleRepositoryError, createCounterSale, readCounterSaleBy } from "@/lib/erp/counter-sale-repository";
import { moPhieuQuay, PhieuQuayError } from "@/lib/erp/phieu-quay";
import { veTuPhieu, type VeQuayHienThi } from "./ve-tu-phieu";

export type XacNhanQuetResult = { ok: true; ve: VeQuayHienThi } | { ok: false; message: string };

/**
 * Khách vừa mở mã QR của quầy trên điện thoại: coi như đã trả (thanh toán giả
 * lập, chủ dự án 12/10/2026) và ghi phiếu bán ngay, dưới tên người bán đã tạo
 * mã. Khoá phiếu trong mã làm cho mở lại, bấm lại hay mạng chập chờn đều chỉ
 * ra đúng một phiếu.
 */
export async function xacNhanQuetAction(ma: string): Promise<XacNhanQuetResult> {
  let phieu;
  try {
    phieu = moPhieuQuay(String(ma ?? ""));
  } catch (error) {
    return { ok: false, message: error instanceof PhieuQuayError ? error.message : "Mã QR này không đọc được." };
  }
  if (phieu.loai !== "cho") return { ok: false, message: "Mã này chỉ để xem lại vé." };
  try {
    const daCo = await readCounterSaleBy({ siteId: phieu.siteId, requestKey: phieu.requestKey });
    const receipt =
      daCo ??
      (await createCounterSale({
        siteId: phieu.siteId,
        actorAccountId: phieu.actorAccountId,
        actorName: phieu.actorName,
        actingDirectorAccountId: phieu.actingDirectorAccountId,
        adults: phieu.adults,
        children: phieu.children,
        paymentMethod: "qr-transfer",
        cashReceivedVnd: 0,
        paymentReference: counterPaymentReference(phieu.requestKey),
        // Khách tự quét mã để trả: hệ thống xác nhận thay nhân viên quầy.
        cashCountedConfirmed: true,
        requestKey: phieu.requestKey,
      }));
    return { ok: true, ve: veTuPhieu(phieu.siteId, receipt) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof CounterSaleRepositoryError
          ? error.message
          : "Chưa xác nhận được. Mời bạn quét lại mã, hoặc báo nhân viên quầy.",
    };
  }
}
