import { expect, test, type Page } from "@playwright/test";

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

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

test("accountant prepares and chief accountant independently posts a real journal", async ({
  page,
}) => {
  await login(page, "ketoan", "Ketoan@2026");
  await page.goto("/erp/finance");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Đối soát & lập bút toán",
    }),
  ).toBeVisible();
  const source = page.locator("article").filter({
    hasText: "SC-TC-20260728-01",
  });
  await expect(source).toContainText("Tam Chúc");
  await source
    .getByRole("button", { name: "Lập bút toán và gửi kiểm tra" })
    .click();
  await expect(
    page
      .locator("details")
      .filter({ hasText: "61000000-0000-4000-8000-000000000002" })
      .first(),
  ).toContainText("Chờ kế toán trưởng");
  await expect(
    page.getByRole("button", { name: "Duyệt và ghi sổ" }),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await logout(page);
  await login(page, "ketoantruong", "Ketoantruong@2026");
  await page.goto("/erp/finance");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Kiểm soát & sổ cái",
    }),
  ).toBeVisible();
  const pendingJournal = page
    .locator("details")
    .filter({ hasText: "61000000-0000-4000-8000-000000000002" })
    .first();
  await expect(pendingJournal).toContainText("Chờ kế toán trưởng");
  await pendingJournal
    .getByLabel("Kết luận kiểm tra")
    .fill("Đã đối chiếu báo cáo ca, nguồn thanh toán và định khoản.");
  await pendingJournal
    .getByRole("button", { name: "Duyệt và ghi sổ" })
    .click();
  await expect(pendingJournal).toContainText("Đã ghi sổ");

  await page.reload();
  await expect(
    page
      .locator("details")
      .filter({ hasText: "61000000-0000-4000-8000-000000000002" })
      .first(),
  ).toContainText("Đã ghi sổ");
  await expect(page.getByText("Cân đối phát sinh đã ghi sổ")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
