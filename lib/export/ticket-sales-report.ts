import { ticketStatusLabel } from "@/domain/erp-ticket-sales";
import type { TicketSalesSummary } from "@/lib/erp/gate-scan-repository";
import type { ErpReport } from "./report";

/**
 * A15-ERP-02 — báo cáo "Vé đã bán", dựng từ đúng `ticketSales` mà khối "Vé đã
 * bán" trong `TicketGuestWorkspace` đang vẽ. Bốn kỳ trên màn hình nằm ở bốn
 * nút chuyển; tệp xuất gom cả bốn thành bốn dòng để so với nhau.
 */

export function ticketSalesHasData(sales: TicketSalesSummary): boolean {
  return (
    sales.productShares.length > 0 ||
    sales.recentSales.length > 0 ||
    sales.periods.some(
      (period) =>
        period.ticketCount > 0 ||
        period.entryCount > 0 ||
        (typeof period.counterRevenueVnd === "number" && period.counterRevenueVnd > 0),
    )
  );
}

export function buildTicketSalesReport(input: { siteName: string; sales: TicketSalesSummary }): ErpReport {
  const { sales } = input;
  const hasRevenue = sales.periods.some((period) => typeof period.counterRevenueVnd === "number");
  const notes = [
    sales.truncated
      ? "Số vé quá nhiều để đọc hết một lần, nên các con số dưới đây đang thấp hơn thực tế."
      : null,
    hasRevenue
      ? "Tiền bán vé tại quầy cộng từ thành tiền chép trên phiếu lúc bán; phiếu đã huỷ tính 0 đ. Lượt khách và số tấm vé đếm trong kho từ mọi vé còn hiệu lực. Vé web mua theo gói gồm nhiều điểm nên chưa chia được giá cho từng cơ sở, không cộng vào ô tiền."
      : "Đếm trực tiếp từ vé đã phát hành, không phải doanh thu quy đổi — hệ thống chưa lưu giá bán trên từng vé.",
  ].filter((note): note is string => Boolean(note));

  return {
    screen: "Vé đã bán",
    site: input.siteName,
    period: "hôm nay, 7 ngày, 30 ngày và 365 ngày gần nhất, tính tới lúc mở trang",
    source: "vé đã phát hành của cơ sở trong hệ thống điều hành. Số liệu lấy lúc mở trang.",
    fileSlug: "ve-da-ban",
    sheets: [
      {
        name: "Vé đã bán",
        tables: [
          {
            title: "Vé đã bán theo kỳ",
            note: notes.join(" "),
            columns: [
              { header: "Kỳ", kind: "text" },
              { header: "Lượt khách được vào", kind: "integer" },
              { header: "Tấm vé đã phát", kind: "integer" },
              { header: "Lượt khách so kỳ liền trước (%)", kind: "number" },
              ...(hasRevenue
                ? [
                    { header: "Tiền bán vé tại quầy (đ)", kind: "integer" as const },
                    { header: "Tấm vé chưa có giá", kind: "integer" as const },
                  ]
                : []),
            ],
            rows: sales.periods.map((period) => [
              period.label,
              period.entryCount,
              period.ticketCount,
              period.changePercent === null ? "chưa đủ dữ liệu kỳ trước" : period.changePercent,
              ...(hasRevenue
                ? [
                    typeof period.counterRevenueVnd === "number" ? period.counterRevenueVnd : null,
                    typeof period.unpricedTicketCount === "number" ? period.unpricedTicketCount : null,
                  ]
                : []),
            ]),
          },
          {
            title: "Loại vé bán chạy · 30 ngày gần nhất",
            note: "Tỷ lệ tính trên lượt khách, không tính trên số tấm vé.",
            columns: [
              { header: "Loại vé", kind: "text" },
              { header: "Lượt khách", kind: "integer" },
              { header: "Tỷ lệ lượt khách (%)", kind: "number" },
              { header: "Tấm vé", kind: "integer" },
            ],
            rows: sales.productShares.map((share) => [
              share.productLabel,
              share.entryCount,
              share.sharePercent,
              share.ticketCount,
            ]),
            emptyText: "Chưa có vé nào phát hành trong 30 ngày gần nhất.",
          },
          {
            title: "Vé phát hành gần nhất",
            columns: [
              { header: "Mã vé", kind: "text" },
              { header: "Loại vé", kind: "text" },
              { header: "Kênh bán", kind: "text" },
              { header: "Giờ phát hành", kind: "datetime" },
              { header: "Trạng thái", kind: "text" },
              { header: "Khách", kind: "text" },
            ],
            rows: sales.recentSales.map((sale) => [
              sale.ticketCode,
              sale.productLabel,
              sale.channelLabel,
              sale.issuedAt,
              ticketStatusLabel(sale.status),
              sale.guestName || "Không có tên",
            ]),
            emptyText: "Chưa có vé nào được phát hành.",
          },
        ],
      },
    ],
  };
}
