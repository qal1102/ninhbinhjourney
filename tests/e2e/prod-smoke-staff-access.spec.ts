import { expect, test, type Page } from "@playwright/test";

// Production verification for the staff-access-manager.tsx /
// attendance-panel.tsx Supabase fix: a change made by one account, in one
// browser session, must be visible to a *different* account logging in from
// a *separate* browser context (simulating a different device). Before the
// fix both actions only wrote to a signed cookie scoped to the acting
// browser, so this exact scenario would silently fail (the employee's
// access would never actually change).
//
// This test mutates real production state (revokes then restores one
// module for employee-trang-an-01), matching the established precedent for
// this project's other real E2E specs (e.g. erp-supplier-ap-workflow.spec.ts).

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

function employeeCard(page: Page) {
  const accessSection = page
    .locator("section")
    .filter({ hasText: "Đội ngũ Tràng An" });
  return accessSection.locator("details").filter({ hasText: "Đỗ Thị Lan" }).first();
}

test("revoking an employee's module in one session denies it for that employee in a completely separate session", async ({
  browser,
}) => {
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await login(managerPage, "ql.vanhanh", "Quanly@2026");
  await managerPage.goto("/erp/trang-an/nhan-su");

  const card = employeeCard(managerPage);
  await card.locator("summary").click();
  const suCoCheckbox = card.getByRole("checkbox", { name: "Sự cố" });
  await expect(suCoCheckbox).toBeChecked();

  // Revoke "Sự cố" for employee-trang-an-01.
  await suCoCheckbox.uncheck();
  await card.getByRole("button", { name: "Lưu phân công" }).click();
  await expect(managerPage.getByText("Đội ngũ Tràng An")).toBeVisible();

  try {
    // A brand new context = a different browser/device with no shared
    // cookies at all. If the grant only lived in the manager's cookie, the
    // employee's access here would be unchanged (test would fail below).
    const employeeContext = await browser.newContext();
    const employeePage = await employeeContext.newPage();
    try {
      await login(employeePage, "nv.trangan", "Nhanvien@2026");
      await employeePage.goto("/erp/trang-an/su-co");
      await expect(employeePage).toHaveURL(/\/erp\/trang-an\?denied=module/, {
        timeout: 15_000,
      });
    } finally {
      await employeeContext.close();
    }
  } finally {
    // Restore original access regardless of test outcome.
    await managerPage.goto("/erp/trang-an/nhan-su");
    const restoreCard = employeeCard(managerPage);
    await restoreCard.locator("summary").click();
    const restoreCheckbox = restoreCard.getByRole("checkbox", {
      name: "Sự cố",
    });
    if (!(await restoreCheckbox.isChecked())) {
      await restoreCheckbox.check();
      await restoreCard
        .getByRole("button", { name: "Lưu phân công" })
        .click();
      await expect(managerPage.getByText("Đội ngũ Tràng An")).toBeVisible();
    }
    await logout(managerPage);
    await managerContext.close();
  }
});
