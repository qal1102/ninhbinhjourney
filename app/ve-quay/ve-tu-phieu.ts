import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import type { CounterProduct, CounterSaleReceipt } from "@/domain/erp-counter-sale";

/** Phần phiếu quầy được đưa ra điện thoại khách: không có tên người bán hay tiền thối. */
export type VeQuayHienThi = {
  saleCode: string;
  siteName: string;
  businessDate: string;
  totalVnd: number;
  daHuy: boolean;
  /** Có khi là vé đoàn: mã đoàn để mở trang trưởng đoàn. */
  doan: { groupCode: string | null; leaderName: string; companyName: string | null; discountVnd: number } | null;
  laVeMoi: boolean;
  lines: { ticketCode: string; product: CounterProduct; quantity: number; entriesAllowed: number; entriesUsed: number }[];
};

export function veTuPhieu(siteId: ErpSiteId, receipt: CounterSaleReceipt): VeQuayHienThi {
  return {
    saleCode: receipt.saleCode,
    siteName: ERP_SITES.find((site) => site.id === siteId)?.name ?? "Ninh Bình",
    businessDate: receipt.businessDate,
    totalVnd: receipt.totalVnd,
    daHuy: receipt.status === "voided",
    doan:
      receipt.saleKind === "group"
        ? {
            groupCode: receipt.groupCode,
            leaderName: receipt.groupLeaderName ?? "",
            companyName: receipt.travelCompany?.name ?? null,
            discountVnd: receipt.discountVnd,
          }
        : null,
    laVeMoi: receipt.saleKind === "comp",
    lines: receipt.lines.map((line) => ({
      ticketCode: line.ticketCode,
      product: line.product,
      quantity: line.quantity,
      entriesAllowed: line.entriesAllowed,
      entriesUsed: line.entriesUsed,
    })),
  };
}
