import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Màn Khách hàng phải ghi nhật ký truy cập TRƯỚC khi đọc bất kỳ dữ liệu khách
 * nào. Ngày 27/09/2026 màn này được gộp các lượt đọc cho chạy song song để
 * bớt chậm; bài này giữ cho sự song song ấy không bao giờ vượt lên trước lượt
 * ghi nhật ký.
 */
const nhatKy = vi.hoisted(() => ({ su: [] as string[], xongGhi: false }));

function doc(ten: string, giaTri: unknown) {
  return async () => {
    nhatKy.su.push(`${ten}:${nhatKy.xongGhi ? "sau" : "TRƯỚC"}`);
    return giaTri;
  };
}

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/components/customer-data/customer-360-dashboard", () => ({ Customer360Dashboard: () => null }));
vi.mock("@/components/erp/visit-review-overview-panel", () => ({ VisitReviewOverviewPanel: () => null }));
vi.mock("@/components/erp/erp-back-link", () => ({ ErpBackLink: () => null }));
vi.mock("@/components/erp/erp-shell", () => ({ ErpShell: () => null }));
vi.mock("@/components/customer-data/khach-thay-gi", () => ({ KhachThayGi: () => null }));
vi.mock("@/lib/erp/erp-back-link", () => ({ ERP_OVERVIEW_BACK_TARGET: { href: "/erp", label: "" } }));
vi.mock("@/lib/erp/demo-session", () => ({
  getCurrentErpUser: async () => ({ id: "director-001", role: "director", mustChangePassword: false, siteIds: [] }),
}));
vi.mock("@/lib/customer-data/journey-repository", () => ({
  isCustomerJourneyPersistenceEnabled: () => true,
  listCustomer360Journeys: async () => {
    // Đọc hành trình tự ghi nhật ký bên trong nó.
    await new Promise((r) => setTimeout(r, 20));
    nhatKy.xongGhi = true;
    nhatKy.su.push("ghi-nhat-ky");
    return [];
  },
}));
vi.mock("@/lib/customer-data/identity-repository", () => ({ auditCustomer360Access: vi.fn() }));
vi.mock("@/lib/customer-data/booking-repository", () => ({
  isCustomerBookingEnabled: () => true,
  listCustomer360BookingOrders: doc("don", [{ profileId: "11111111-1111-4111-8111-111111111111" }]),
}));
vi.mock("@/lib/customer-data/recommendation-repository", () => ({
  isCustomerRecommendationsEnabled: () => true,
  listCustomer360Recommendations: doc("goi-y", { recommendations: [], outboundActions: [] }),
}));
vi.mock("@/lib/customer-data/visit-review-overview-repository", () => ({ listSiteReviewOverview: doc("danh-gia", []) }));
vi.mock("@/lib/erp/visit-review-moderation-repository", () => ({ hideQuotaUsed: doc("han-muc", 0) }));
vi.mock("@/lib/customer-data/ho-so-khach-repository", () => ({ hoSoTheoMaHoSo: doc("ho-so", null) }));

import Customer360Page from "@/app/erp/khach-hang/page";

describe("màn Khách hàng ghi nhật ký trước khi đọc dữ liệu khách", () => {
  beforeEach(() => {
    nhatKy.su = [];
    nhatKy.xongGhi = false;
  });

  it("mọi lượt đọc, kể cả hồ sơ chỉ định qua đường dẫn, đều chạy sau lượt ghi nhật ký", async () => {
    await Customer360Page({ searchParams: Promise.resolve({ xem: "22222222-2222-4222-8222-222222222222" }) });
    expect(nhatKy.su[0]).toBe("ghi-nhat-ky");
    expect(nhatKy.su.filter((s) => s.endsWith(":TRƯỚC"))).toEqual([]);
    expect(nhatKy.su).toEqual(expect.arrayContaining(["don:sau", "goi-y:sau", "danh-gia:sau", "han-muc:sau", "ho-so:sau"]));
  });

  it("chưa chỉ định khách thì lấy khách của đơn mới nhất, vẫn sau nhật ký", async () => {
    await Customer360Page({ searchParams: Promise.resolve({}) });
    expect(nhatKy.su[0]).toBe("ghi-nhat-ky");
    expect(nhatKy.su.filter((s) => s.endsWith(":TRƯỚC"))).toEqual([]);
    expect(nhatKy.su.filter((s) => s.startsWith("ho-so"))).toEqual(["ho-so:sau"]);
  });
});
