import { expect, test, type Page } from "@playwright/test";

// Read-only production gate: forms are inspected but never submitted, so no
// fake opening assessment or director decision reaches the real database.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page
    .getByLabel(/Email hoặc tên đăng nhập|Tên đăng nhập/)
    .fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/, { timeout: 25_000 });
}

async function expectUnapprovedSopLibrary(page: Page) {
  await expect(
    page.getByRole("heading", { name: "An toàn chưa đạt thì chưa gọi là GO" }),
  ).toBeVisible({ timeout: 25_000 });
  await expect(
    page.getByText(
      "Demo operational summary — requires organizational approval.",
    ),
  ).toBeVisible();
  await expect(page.getByText("SOP-CMD-03 · Chỉ huy và bàn giao đầu ngày")).toBeVisible();
}

test("quản lý thấy checklist thật nhưng smoke không ghi dữ liệu", async ({ page }) => {
  await login(page, "ql.tamchuc", "Quanly@2026");
  await page.goto("/erp/tam-chuc/sop-dien-tap");
  await expectUnapprovedSopLibrary(page);
  await expect(
    page.getByRole("button", { name: "Ghi quyết định" }),
  ).toHaveCount(0);
});

test("giám đốc đọc cổng và inbox mà smoke không ghi dữ liệu", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/tam-chuc/sop-dien-tap");
  await expectUnapprovedSopLibrary(page);
  await expect(
    page.getByRole("button", { name: "Gửi giám đốc quyết định" }),
  ).toHaveCount(0);
  await page.goto("/erp");
  await expect(page.getByText("cổng Go/No-Go")).toBeVisible();
  expect(errors, `unexpected runtime errors: ${errors.join(" | ")}`).toEqual([]);
});
