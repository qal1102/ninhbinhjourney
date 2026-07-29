import { expect, test } from "@playwright/test";

async function loginAsManager(page: import("@playwright/test").Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("ql.trangan");
  await page.getByLabel("Mật khẩu").fill("Quanly@2026");
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("module help explains the current responsibility and fits the viewport", async ({
  page,
}) => {
  await loginAsManager(page);
  await page.goto("/erp/trang-an/bao-cao-hien-truong");

  await expect(page.getByText("Cập nhật lúc 10:20")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Trợ giúp về Báo cáo hiện trường" })
    .click();

  const dialog = page.getByRole("dialog", {
    name: "Báo cáo hiện trường",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Tràng An · Quản lý cơ sở");
  await expect(dialog).toContainText("Trách nhiệm của bạn");
  await expect(dialog).toContainText("Khi hồ sơ đã đủ hoặc còn thiếu");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await dialog.getByRole("button", { name: "Đã hiểu" }).click();
  await expect(dialog).toBeHidden();
});
