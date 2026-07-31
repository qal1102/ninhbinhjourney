import { expect, test, type Page } from "@playwright/test";

// Read-only production smoke for the AP-NCC batch just deployed.
// Does NOT click any mutating action (approve/reject/post) - only verifies
// each role can log in and see real Supabase-backed content.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

async function logout(page: Page) {
  const mobileMenu = page.getByRole("button", { name: "Mở menu" });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
  }
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/erp\/login/);
}

test("accountant sees the live supplier AP control center on production", async ({
  page,
}, testInfo) => {
  await login(page, "ketoan", "Ketoan@2026");
  await page.goto("/erp/finance");
  await expect(
    page.getByRole("heading", { name: /Đối tác|Công nợ|Nhà cung cấp/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
  // The two records the earlier real E2E run left in known states.
  await expect(page.getByText("AP-TA-202607-024", { exact: true })).toBeVisible();
  await expect(page.getByText("AP-TC-202607-027", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("prod-accountant-finance.png"),
    fullPage: true,
  });
  await logout(page);
});

test("chief accountant sees the AP inbox on production", async ({
  page,
}, testInfo) => {
  await login(page, "ketoantruong", "Ketoantruong@2026");
  await page.goto("/erp/finance");
  await expect(page.getByText("AP-TA-202607-024", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({
    path: testInfo.outputPath("prod-chief-accountant-finance.png"),
    fullPage: true,
  });
  await logout(page);
});

test("director sees the supplier payables summary on production", async ({
  page,
}, testInfo) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("prod-director-home.png"),
    fullPage: true,
  });
  await page.goto("/erp/finance");
  await expect(page.getByText(/AP-TC-202607-027|AP-TA-202607-024/).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({
    path: testInfo.outputPath("prod-director-finance.png"),
    fullPage: true,
  });
  await logout(page);
});

test("manager sees the supplier AP control center at site level on production", async ({
  page,
}, testInfo) => {
  await login(page, "ql.vanhanh", "Quanly@2026");
  await page.goto("/erp/trang-an/doi-tac-nha-cung-ung");
  await expect(page.getByText("AP-TA-202607-024", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({
    path: testInfo.outputPath("prod-manager-ap.png"),
    fullPage: true,
  });
  await logout(page);
});
