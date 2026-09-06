import { describe, expect, it } from "vitest";
import { isDemoTicketCode } from "@/domain/erp-ticket-code";

describe("isDemoTicketCode", () => {
  it("nhận đúng dạng mã vé mẫu đang có trên production", () => {
    // 8 vé gieo ngày 02/08/2026 đều mang dạng này.
    for (const code of ["TA-2026-000101", "TCO-2026-000104", "BD-2026-000107"]) {
      expect(isDemoTicketCode(code)).toBe(true);
    }
  });

  it("không nhận vé bán qua web", () => {
    // `WEB-` cộng 12 ký tự -- đây là vé của khách thật, không được gọi là mẫu.
    for (const code of ["WEB-A1B2C3D4E5F6", "WEB-000000000001"]) {
      expect(isDemoTicketCode(code)).toBe(false);
    }
  });

  it("từ chối mã gần giống nhưng sai dạng", () => {
    for (const code of [
      "ta-2026-000101", // chữ thường
      "TAAA-2026-000101", // bốn chữ cái
      "TA-26-000101", // năm hai chữ số
      "TA-2026-00010", // thiếu một chữ số
      " TA-2026-000101", // thừa khoảng trắng
      "",
    ]) {
      expect(isDemoTicketCode(code)).toBe(false);
    }
  });
});
