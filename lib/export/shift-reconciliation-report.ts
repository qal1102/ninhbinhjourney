import { erpDataOriginLabel } from "@/domain/erp-data-origin";
import {
  SHIFT_SCAN_RESULT_KEYS,
  SHIFT_SCAN_RESULT_LABELS,
  type ShiftGapLevel,
} from "@/domain/erp-shift-reconciliation";
import type { ShiftReconciliationSource } from "@/lib/erp/shift-reconciliation-repository";
import {
  formatReportValue,
  formatVietnameseNumber,
  formatVietnamTimestamp,
  type ErpReport,
  type ReportTable,
} from "./report";

/**
 * A15-ERP-02 — báo cáo "Đối soát cuối ca", dựng từ đúng `view.selected` mà
 * `ShiftReconciliationPanel` đang vẽ. Mỗi câu "chưa đọc được" hay "chưa có"
 * lấy nguyên từ màn hình, để tệp không bao giờ hiện số 0 ở chỗ màn hình nói
 * là chưa đếm được.
 */

function vnd(value: number) {
  return `${formatVietnameseNumber(value)} ₫`;
}

export function buildShiftReconciliationReport(input: {
  siteName: string;
  source: ShiftReconciliationSource;
  /** Chữ trạng thái đang hiện trên màn hình. */
  statusLabel: string;
  /** Chữ mức độ trên từng thẻ lưu ý, đúng như màn hình. */
  gapLevelLabels: Readonly<Record<ShiftGapLevel, string>>;
}): ErpReport {
  const { shift, reconciliation, scanUnavailableReason, cashUnavailableReason, counterCashUnavailableReason } =
    input.source;
  const { window, scans, scanBreakdown, cash, counterCash, differences, gaps } = reconciliation;
  const businessDate = formatReportValue(shift.businessDate, "date");
  const windowText =
    window.dayKeys.length > 0
      ? `${formatVietnamTimestamp(window.from)} → ${formatVietnamTimestamp(window.to)} (giờ Việt Nam)`
      : null;
  const originLabel = erpDataOriginLabel(shift.dataOrigin);

  const tables: ReportTable[] = [];

  tables.push({
    title: "Hồ sơ ca",
    columns: [
      { header: "Mục", kind: "text" },
      { header: "Nội dung", kind: "text" },
    ],
    rows: [
      ["Mã ca", shift.shiftCode],
      ["Ca", shift.shiftLabel],
      ["Vị trí", shift.station],
      ["Ngày làm việc", businessDate],
      ["Người gửi", shift.submittedByName],
      ["Trạng thái", input.statusLabel],
      ...(windowText ? [["Khung giờ đối soát", windowText]] : []),
      ...(originLabel
        ? [["Loại hồ sơ", `${originLabel}: ca này là hồ sơ gieo sẵn lúc dựng hệ thống, không phải ca thật`]]
        : []),
    ],
  });

  tables.push({
    title: "Chênh lệch",
    note: "Chênh lệch là số hệ thống đếm được trừ số nhân viên khai. Số dương nghĩa là hệ thống đếm được nhiều hơn phần khai.",
    columns: [
      { header: "Khoản", kind: "text" },
      { header: "Đơn vị", kind: "text" },
      { header: "Nhân viên khai", kind: "integer" },
      { header: "Hệ thống đếm được", kind: "integer" },
      { header: "Chênh lệch", kind: "integer" },
      { header: "Ghi chú", kind: "text" },
    ],
    rows: differences.map((difference) => {
      const unreadable = difference.counted === null || difference.delta === null;
      return [
        difference.label,
        difference.unit === "vnd" ? "đồng" : "lượt",
        difference.declared === null ? "—" : difference.declared,
        difference.counted === null ? "chưa đọc được" : difference.counted,
        unreadable ? "—" : difference.delta,
        difference.caveat,
      ];
    }),
  });

  if (gaps.length > 0) {
    tables.push({
      title: "Cần lưu ý",
      columns: [
        { header: "Mức độ", kind: "text" },
        { header: "Việc cần xem", kind: "text" },
        { header: "Chi tiết", kind: "text" },
      ],
      rows: gaps.map((gap) => [input.gapLevelLabels[gap.level], gap.title, gap.detail]),
    });
  }

  const scanColumns = [
    { header: "Nhóm", kind: "text" as const },
    { header: "Số lượt", kind: "integer" as const },
  ];
  if (!scans || !scanBreakdown) {
    tables.push({
      title: "Lượt quét trong ca",
      columns: scanColumns,
      rows: [],
      emptyText: scanUnavailableReason || "Chưa đọc được nhật ký quét cổng của ca này.",
    });
  } else if (scans.total === 0) {
    tables.push({
      title: "Lượt quét trong ca",
      columns: scanColumns,
      rows: [],
      emptyText:
        "Suốt khung giờ này chưa có lượt quét nào ở cổng. Vì vậy chưa có gì để đối soát.",
    });
  } else {
    tables.push({
      title: "Lượt quét trong ca",
      columns: scanColumns,
      rows: [
        ["Cho vào", scans.admitted],
        ["Chưa thu tiền", scans.paymentDue],
        ["Từ chối", scans.refused],
      ],
    });
    tables.push({
      title: "Lượt quét theo kết quả",
      columns: [
        { header: "Kết quả quét", kind: "text" },
        { header: "Số lượt", kind: "integer" },
      ],
      rows: SHIFT_SCAN_RESULT_KEYS.filter((key) => scanBreakdown[key] > 0).map((key) => [
        SHIFT_SCAN_RESULT_LABELS[key],
        scanBreakdown[key],
      ]),
    });
  }

  const cashColumns = [
    { header: "Người thu", kind: "text" as const },
    { header: "Số khoản", kind: "integer" as const },
    { header: "Số tiền (đ)", kind: "integer" as const },
  ];
  if (!cash) {
    tables.push({
      title: "Tiền thu tại điểm",
      columns: cashColumns,
      rows: [],
      emptyText: cashUnavailableReason || "Chưa đọc được khoản thu tại cổng của ca này.",
    });
  } else if (cash.count === 0) {
    tables.push({
      title: "Tiền thu tại điểm",
      columns: cashColumns,
      rows: [],
      emptyText:
        "Ca này chưa có khoản thu tại điểm nào vào sổ." +
        (cash.outstandingCount > 0
          ? ` Cơ sở còn ${formatVietnameseNumber(cash.outstandingCount)} đơn khách chọn trả tại điểm chưa ai thu, tổng ${vnd(cash.outstandingVnd)}.`
          : ""),
    });
  } else {
    tables.push({
      title: "Tiền thu tại điểm",
      note: "Thu ngay tại cổng.",
      columns: cashColumns,
      rows: cash.collectors.map((collector) => [collector.displayName, collector.count, collector.totalVnd]),
      totalRow: ["Tổng cả ca", cash.count, cash.totalVnd],
    });
  }

  const counterColumns = [
    { header: "Khoản", kind: "text" as const },
    { header: "Số phiếu", kind: "integer" as const },
    { header: "Số tiền (đ)", kind: "integer" as const },
  ];
  if (!counterCash) {
    tables.push({
      title: "Tiền bán tại quầy",
      columns: counterColumns,
      rows: [],
      emptyText: counterCashUnavailableReason || "Chưa đọc được tiền bán tại quầy của ca này.",
    });
  } else if (counterCash.count + counterCash.qrCount + counterCash.voidedCount === 0) {
    tables.push({
      title: "Tiền bán tại quầy",
      columns: counterColumns,
      rows: [],
      emptyText: "Ca này chưa có phiếu bán vé tại quầy nào.",
    });
  } else {
    tables.push({
      title: "Tiền bán tại quầy",
      columns: counterColumns,
      rows: [
        ["Tiền mặt phải có trong quỹ", counterCash.count, counterCash.totalVnd],
        ...(counterCash.qrCount > 0
          ? [["Chuyển khoản QR, tiền nằm ở tài khoản ngân hàng", counterCash.qrCount, counterCash.qrTotalVnd]]
          : []),
        ...(counterCash.voidedCount > 0
          ? [["Phiếu đã huỷ, đã hoàn cho khách", counterCash.voidedCount, counterCash.voidedVnd]]
          : []),
      ],
    });
    tables.push({
      title: "Tiền bán tại quầy theo người bán",
      columns: [
        { header: "Người bán", kind: "text" },
        { header: "Số phiếu", kind: "integer" },
        { header: "Tiền mặt (đ)", kind: "integer" },
        { header: "Chuyển khoản QR (đ)", kind: "integer" },
      ],
      rows: counterCash.sellers.map((seller) => [
        seller.displayName,
        seller.count,
        seller.totalVnd,
        seller.qrTotalVnd,
      ]),
    });
  }

  return {
    screen: "Đối soát cuối ca",
    site: input.siteName,
    period: `Ca ${shift.shiftCode} · ${shift.shiftLabel} · ngày làm việc ${businessDate}`,
    source:
      "tờ chốt ca nhân viên gửi, nhật ký quét cổng, khoản thu tại điểm và phiếu bán tại quầy trong khung giờ của ca. Số liệu lấy lúc mở trang.",
    fileSlug: "doi-soat-ca",
    fileQualifiers: [shift.shiftCode],
    sheets: [{ name: "Đối soát ca", tables }],
  };
}
