import { describe, expect, it } from "vitest";
import { summarizeFieldReports } from "@/domain/erp-field-report-summary";

const at = new Date("2026-09-05T05:00:00.000Z"); // 12:00 giờ Việt Nam

function report(
  status: string,
  createdAt: string,
  imageUrl: string | null = "https://example.test/a.jpg",
) {
  return { status, createdAt, imageUrl };
}

describe("summarizeFieldReports", () => {
  it("danh sách rỗng cho ra bốn số 0, không cộng thêm gì", () => {
    // Bản cũ trả 21 ở đây. Bài này khoá đúng chỗ đó.
    expect(summarizeFieldReports([], at)).toEqual({
      today: 0,
      awaitingConfirmation: 0,
      confirmed: 0,
      missingEvidence: 0,
    });
  });

  it("đếm đúng bốn nhóm trên dữ liệu thật của production", () => {
    const reports = [
      report("Chờ quản lý xác nhận", "2026-09-05T02:00:00.000Z"),
      report("Chờ quản lý xác nhận", "2026-09-01T02:00:00.000Z"),
      report("Đã xác nhận", "2026-09-05T03:00:00.000Z"),
      report("Đang xử lý", "2026-08-30T03:00:00.000Z", null),
      report("Hoàn thành", "2026-08-29T03:00:00.000Z"),
    ];

    expect(summarizeFieldReports(reports, at)).toEqual({
      today: 2,
      awaitingConfirmation: 2,
      confirmed: 1,
      missingEvidence: 1,
    });
  });

  it("cắt ngày theo giờ Việt Nam, không theo giờ quốc tế", () => {
    // 2026-09-04T18:30Z là 01:30 ngày 05/09 ở Việt Nam -- vẫn là hôm nay.
    // 2026-09-05T17:30Z là 00:30 ngày 06/09 -- đã sang ngày mới.
    const reports = [
      report("Hoàn thành", "2026-09-04T18:30:00.000Z"),
      report("Hoàn thành", "2026-09-05T17:30:00.000Z"),
    ];

    expect(summarizeFieldReports(reports, at).today).toBe(1);
  });

  it("chịu được khác biệt dấu và hoa thường trong trạng thái", () => {
    const reports = [
      report("CHỜ QUẢN LÝ XÁC NHẬN", "2026-09-05T02:00:00.000Z"),
      report("da xac nhan", "2026-09-05T02:00:00.000Z"),
    ];

    const summary = summarizeFieldReports(reports, at);
    expect(summary.awaitingConfirmation).toBe(1);
    expect(summary.confirmed).toBe(1);
  });

  it("không nhầm 'Đang xử lý' thành 'chờ xác nhận'", () => {
    const reports = [report("Đang xử lý", "2026-09-05T02:00:00.000Z")];
    expect(summarizeFieldReports(reports, at).awaitingConfirmation).toBe(0);
  });
});
