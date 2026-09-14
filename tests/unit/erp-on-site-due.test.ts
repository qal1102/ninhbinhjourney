import { describe, expect, it } from "vitest";
import { noShowEligibility, parseOnSiteDueOrders, validateNoShowReason } from "@/domain/erp-on-site-due";

const don = (ghiDe: Record<string, unknown> = {}) => ({
  order_code: "NBJ-38D383D3A328",
  visit_date: "2026-09-13",
  party_size: 2,
  amount_vnd: 1580000,
  entries_used: 0,
  ticket_codes: ["WEB-2B777738ECC7"],
  ...ghiDe,
});

describe("QA-DON-DU-LIEU-10 — đơn trả tại điểm còn chờ thu", () => {
  it("đọc đúng đơn, bỏ dòng mã hỏng hay ngày hỏng", () => {
    const ds = parseOnSiteDueOrders([don(), don({ order_code: "NBJ-123" }), don({ visit_date: "13/09/2026" }), null]);
    expect(ds).toEqual([
      { orderCode: "NBJ-38D383D3A328", visitDate: "2026-09-13", partySize: 2, amountVnd: 1580000, entriesUsed: 0, ticketCodes: ["WEB-2B777738ECC7"] },
    ]);
    expect(parseOnSiteDueOrders("khong phai mang")).toEqual([]);
  });

  it("chỉ đóng được khi đã qua ngày đi và chưa ai vào cổng, đúng như máy chủ", () => {
    const [d] = parseOnSiteDueOrders([don()]);
    expect(noShowEligibility(d, "2026-09-14")).toEqual({ ok: true });
    expect(noShowEligibility(d, "2026-09-13").ok).toBe(false);
    expect(noShowEligibility({ ...d, entriesUsed: 1 }, "2026-09-20").ok).toBe(false);
  });

  it("lý do phải từ mười tới năm trăm ký tự", () => {
    expect(validateNoShowReason("không đến").ok).toBe(false);
    expect(validateNoShowReason("Gọi hai lần không nghe máy").ok).toBe(true);
    expect(validateNoShowReason("x".repeat(501)).ok).toBe(false);
  });
});
