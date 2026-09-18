"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  buildReportXlsx,
  formatReportValue,
  parseReportMoment,
  reportFileName,
  reportHeading,
  type ErpReport,
  type ReportColumnKind,
  type ReportValue,
} from "@/lib/export/report";
import { XLSX_MIME_TYPE } from "@/lib/export/xlsx";

/**
 * A15-ERP-02 — hai nút "Tải Excel" và "In / Lưu PDF" cho một báo cáo ERP.
 *
 * Nhận đúng mô hình báo cáo màn hình đã dựng từ dữ liệu nó đang vẽ. Tệp Excel
 * và bản in đều đọc từ mô hình ấy, không gọi thêm máy chủ lần nào.
 *
 * In: dựng bản in vào thẳng `<body>`, gắn cờ `data-erp-printing` lên `<html>`
 * rồi gọi `window.print()`. CSS in trong `app/globals.css` chỉ có hiệu lực khi
 * có cờ ấy, nên bấm Ctrl+P bình thường vẫn in trang như cũ.
 */

const PRINTING_ATTRIBUTE = "data-erp-printing";

const BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] outline-none transition hover:border-[#8fa99f] hover:bg-[#f7f9f7] focus-visible:ring-2 focus-visible:ring-[#183f34] focus-visible:ring-offset-2";

function cellKind(value: ReportValue, kind: ReportColumnKind): "number" | "date" | "text" {
  if (typeof value === "number") return "number";
  if ((kind === "date" || kind === "datetime") && typeof value === "string" && parseReportMoment(value)) {
    return "date";
  }
  return "text";
}

export function ReportPrintSheet({ report, exportedAt }: { report: ErpReport; exportedAt: Date }) {
  const heading = reportHeading(report, exportedAt);
  // Bảng công nợ NCC có 12 cột: in khổ dọc thì cột tên nhà cung cấp bị ép còn
  // một chữ mỗi dòng. Từ 8 cột trở lên in khổ ngang.
  const widestTable = Math.max(
    0,
    ...report.sheets.flatMap((sheet) => sheet.tables.map((table) => table.columns.length)),
  );
  return (
    <div
      data-erp-print-root=""
      data-orientation={widestTable >= 8 ? "landscape" : undefined}
      className="erp-print-sheet"
      lang="vi"
    >
      <header className="erp-print-heading">
        <h1>{heading.title}</h1>
        {heading.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </header>
      {report.sheets.flatMap((sheet) =>
        sheet.tables.map((table, tableIndex) => (
          <section key={`${sheet.name}-${tableIndex}`} className="erp-print-section">
            <h2>{table.title}</h2>
            {table.note ? <p className="erp-print-note">{table.note}</p> : null}
            {table.rows.length === 0 ? (
              table.emptyText ? <p className="erp-print-empty">{table.emptyText}</p> : null
            ) : (
              <table>
                <thead>
                  <tr>
                    {table.columns.map((column, columnIndex) => (
                      <th
                        key={columnIndex}
                        scope="col"
                        data-kind={column.kind === "integer" || column.kind === "number" ? "number" : "text"}
                      >
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...table.rows, ...(table.totalRow ? [table.totalRow] : [])].map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      data-total={table.totalRow && rowIndex === table.rows.length ? "" : undefined}
                    >
                      {table.columns.map((column, columnIndex) => {
                        const value = row[columnIndex] ?? null;
                        return (
                          <td key={columnIndex} data-kind={cellKind(value, column.kind)}>
                            {formatReportValue(value, column.kind)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )),
      )}
    </div>
  );
}

export function ReportExportBar({ report, className = "" }: { report: ErpReport; className?: string }) {
  const [printAt, setPrintAt] = useState<Date | null>(null);
  const [message, setMessage] = useState("");
  const finishPrintRef = useRef<(() => void) | null>(null);

  // Rời màn hình giữa lúc hộp thoại in còn mở thì vẫn gỡ cờ, để lần in sau
  // của trang khác không bị ẩn trắng.
  useEffect(
    () => () => {
      finishPrintRef.current?.();
    },
    [],
  );

  function handleDownload() {
    try {
      const exportedAt = new Date();
      const bytes = buildReportXlsx(report, exportedAt);
      const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME_TYPE }));
      const link = document.createElement("a");
      link.href = url;
      link.download = reportFileName(report, exportedAt);
      link.rel = "noopener";
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Thu hồi ngay thì vài trình duyệt huỷ luôn lượt tải đang bắt đầu.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("");
    } catch {
      setMessage("Chưa tạo được tệp Excel. Mời bạn bấm thử lại ạ.");
    }
  }

  function handlePrint() {
    finishPrintRef.current?.();
    const root = document.documentElement;
    const finish = () => {
      window.removeEventListener("afterprint", finish);
      root.removeAttribute(PRINTING_ATTRIBUTE);
      finishPrintRef.current = null;
      setPrintAt(null);
    };
    finishPrintRef.current = finish;
    // Bản in phải nằm sẵn trong trang trước khi hộp thoại in chụp trang lại.
    flushSync(() => setPrintAt(new Date()));
    root.setAttribute(PRINTING_ATTRIBUTE, "");
    window.addEventListener("afterprint", finish);
    try {
      window.print();
      setMessage("");
    } catch {
      finish();
      setMessage("Trình duyệt này chưa mở được hộp thoại in. Mời bạn thử lại trên máy tính ạ.");
    }
  }

  return (
    <div
      role="group"
      aria-label={`Xuất báo cáo ${report.screen.toLocaleLowerCase("vi")}`}
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      <button type="button" onClick={handleDownload} className={BUTTON_CLASS}>
        Tải Excel
      </button>
      <button type="button" onClick={handlePrint} className={BUTTON_CLASS}>
        In / Lưu PDF
      </button>
      {message ? (
        <p role="alert" className="w-full text-xs font-bold text-[#91483a]">
          {message}
        </p>
      ) : null}
      {printAt ? createPortal(<ReportPrintSheet report={report} exportedAt={printAt} />, document.body) : null}
    </div>
  );
}
