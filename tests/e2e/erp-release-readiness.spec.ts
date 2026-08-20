import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("A6 fails closed and exposes no secret values when release inputs are absent", async ({ page }) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/release");
  await expect(page.getByRole("heading", { name: "Sẵn sàng phát hành dữ liệu khách hàng" })).toBeVisible();
  await expect(page.getByTestId("release-verdict")).toHaveText("CHƯA ĐƯỢC BẬT PRODUCTION");
  await expect(page.getByTestId("release-phase-CUS-08")).toContainText("Chưa probe");
  await expect(page.getByTestId("release-flag-ERP_OFFLINE_GATE_ENABLED")).toContainText("OFF");
  await expect(page.locator("body")).not.toContainText("playwright-customer-identity-hash-key-at-least-32-chars");
});

test("A6 release gate is director-only", async ({ page }) => {
  await login(page, "ql.vanhanh", "Quanly@2026");
  await page.goto("/erp/release");
  await expect(page).toHaveURL(/\/erp\?denied=release$/);
  await expect(page.getByTestId("customer-release-readiness")).toHaveCount(0);
});
