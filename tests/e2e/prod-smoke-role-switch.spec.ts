import { expect, test, type Page } from "@playwright/test";

// Production verification for V3 in docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md.
// This is a REAL session swap, not a UI role flag: it must be true that
// (a) only a director can see/use the control, (b) switching actually
// changes what the server lets the account do (blocked where the target
// role would normally be blocked), (c) a persistent banner is visible the
// whole time, and (d) returning to director restores full access.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("chỉ giám đốc mới thấy nút 'Xem theo vai trò'", async ({ page }) => {
  await login(page, "ql.vanhanh", "Quanly@2026");
  await expect(page.getByText("Xem theo vai trò")).toHaveCount(0);
});

test("giám đốc chuyển sang xem như nhân viên: bị chặn đúng như nhân viên thật, có băng thông báo, quay lại được", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");

  // Director can reach every site before switching.
  await page.goto("/erp/tam-chuc");
  await expect(page).toHaveURL(/\/erp\/tam-chuc$/);

  // RoleSwitchControl renders twice in the DOM: once in the desktop nav
  // (hidden below the lg breakpoint via CSS, not removed) and once inside
  // the mobile hamburger menu -- both exist regardless of viewport, so every
  // locator in this block must stay scoped to whichever container actually
  // applies. Decide by the configured viewport against Tailwind's `lg`
  // breakpoint (1024px) rather than a DOM isVisible() snapshot: the latter
  // raced against layout under parallel load and intermittently picked the
  // desktop copy on the mobile-chromium project.
  const isMobileViewport = (page.viewportSize()?.width ?? 1280) < 1024;
  let roleSwitchContainer = page.getByRole("banner");
  if (isMobileViewport) {
    await page.getByRole("button", { name: "Mở menu" }).click();
    roleSwitchContainer = page.getByLabel("Menu điều hành");
  }
  await roleSwitchContainer.getByText("Xem theo vai trò").click();
  await roleSwitchContainer
    .locator('select[name="targetUserId"]')
    .selectOption("employee-trang-an-01");
  await roleSwitchContainer.getByRole("button", { name: "Xem thử" }).click();
  await expect(page).toHaveURL(/\/erp$/);

  // Banner is present on every page while impersonating.
  const banner = page.getByRole("status").filter({ hasText: "Đang xem với vai trò" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Nhân viên");
  await expect(banner).toContainText("Đỗ Thị Lan");

  // Real permission narrowing: the employee cannot reach a site they were
  // never assigned, exactly like nv.trangan logging in for real.
  await page.goto("/erp/tam-chuc");
  await expect(page).toHaveURL(/\/erp\?denied=site/);

  // But their own site's module they have access to works.
  await page.goto("/erp/trang-an/cham-cong");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // No new permission: a module the employee was never granted stays denied.
  await page.goto("/erp/trang-an/nhan-su");
  await expect(page).toHaveURL(/\/erp\/trang-an\?denied=module/);

  // Return to director restores full access and removes the banner.
  await page.goto("/erp/trang-an");
  await page.getByRole("button", { name: "Quay lại giám đốc" }).click();
  await expect(page).toHaveURL(/\/erp$/);
  await expect(page.getByRole("status").filter({ hasText: "Đang xem với vai trò" })).toHaveCount(0);

  await page.goto("/erp/tam-chuc");
  await expect(page).toHaveURL(/\/erp\/tam-chuc$/);
});
