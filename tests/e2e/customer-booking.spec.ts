import { expect, test } from "@playwright/test";

test.describe("CUS-06 anonymous ERP-backed booking", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/customer-booking-holds", async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body.anonymous_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body).not.toHaveProperty("email");
      expect(body).not.toHaveProperty("phone");
      expect(body).not.toHaveProperty("card_number");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          duplicate: false,
          order: { id: "50000000-0000-4000-8000-000000000001", code: "NBJ-ABCDEF123456" },
          hold: { id: "60000000-0000-4000-8000-000000000001", status: "active", expires_at: new Date(Date.now() + 15 * 60_000).toISOString() },
          amount: { total_vnd: 1_780_000, currency: "VND" },
          slots: [{
            slotId: "70000000-0000-4000-8000-000000000001",
            siteId: "10000000-0000-4000-8000-000000000001",
            startsAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
            endsAt: new Date(Date.now() + 25 * 60 * 60_000).toISOString(),
            capacitySource: "estimate",
            thresholdVersion: 1,
          }],
        }),
      });
    });
    await page.route("**/api/customer-booking-confirmations", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body).toEqual({
        payment_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        hold_id: "60000000-0000-4000-8000-000000000001",
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          duplicate: false,
          order: { id: "50000000-0000-4000-8000-000000000001", code: "NBJ-ABCDEF123456", status: "confirmed" },
          payment: { id: "80000000-0000-4000-8000-000000000001", status: "succeeded", mode: "simulation" },
          tickets: [{
            ticketId: "90000000-0000-4000-8000-000000000001",
            ticketCode: "WEB-ABCDEF123456",
            siteId: "10000000-0000-4000-8000-000000000001",
            validOn: "2026-08-21",
            entriesAllowed: 2,
            status: "issued",
          }],
        }),
      });
    });
  });

  test("holds shared capacity then confirms a simulated payment into a T8 ticket", async ({ page }) => {
    await page.goto("/checkout?package=heritage-day");
    await expect(page.getByRole("heading", { name: /Một chỗ đã giữ/i })).toBeVisible();
    await expect(page.getByText(/Thanh toán mô phỏng — không thu tiền/i)).toBeVisible();
    await expect(page.getByLabel(/email|điện thoại|số thẻ/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
    await expect(page.getByText("Ước tính vận hành T11a")).toBeVisible();
    await expect(page.getByText(/Đã giữ chỗ thật trong kho công suất/i)).toBeVisible();

    await page.getByRole("button", { name: "Xác nhận thanh toán mô phỏng" }).click();
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("NBJ-ABCDEF123456");
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("WEB-ABCDEF123456");
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("2 lượt vào");
  });
});
