import { describe, expect, it } from "vitest";
import { formatVietnameseDate } from "@/lib/vietnamese-date";

describe("QA-P2-09 — đọc lại ngày kiểu Việt Nam", () => {
  it("ghi thứ và ngày/tháng/năm, không lẫn tháng với ngày", () => {
    expect(formatVietnameseDate("2026-09-15")).toBe("Thứ Ba, 15/09/2026");
    expect(formatVietnameseDate("2026-09-13")).toBe("Chủ nhật, 13/09/2026");
    expect(formatVietnameseDate("2026-02-03")).toBe("Thứ Ba, 03/02/2026");
  });

  it("ngày không có thật hay rỗng thì không đọc bừa", () => {
    expect(formatVietnameseDate("2026-02-30")).toBe("");
    expect(formatVietnameseDate("")).toBe("");
    expect(formatVietnameseDate(undefined)).toBe("");
    expect(formatVietnameseDate("15/09/2026")).toBe("");
  });
});
