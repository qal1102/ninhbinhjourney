import { expect, test, type Page } from "@playwright/test";

const REMOTE_ACTION_TIMEOUT = 20_000;

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

function invoiceCard(page: Page, caseCode: string) {
  return page.locator("details").filter({ hasText: caseCode }).first();
}

test("manager handoff persists and accountant prepares the liability journal", async ({
  page,
}) => {
  await login(page, "ql.vanhanh", "Quanly@2026");
  await page.goto("/erp/trang-an/doi-tac-nha-cung-ung");

  const card = invoiceCard(page, "AP-TA-202607-024");
  await expect(card).toContainText("Sẵn sàng hạch toán");
  await expect(card).not.toContainText("Thiếu biên bản nhận hàng/nghiệm thu");
  await expectNoHorizontalOverflow(page);

  await logout(page);
  await login(page, "ketoan", "Ketoan@2026");
  await page.goto("/erp/finance");

  const accountantCard = invoiceCard(page, "AP-TA-202607-024");
  await expect(accountantCard).toContainText("Sẵn sàng hạch toán");
  await accountantCard.click();
  await accountantCard
    .getByRole("button", { name: "Lập công nợ và gửi kiểm tra" })
    .click();
  await expect(accountantCard).toContainText("Chờ kế toán trưởng", {
    timeout: REMOTE_ACTION_TIMEOUT,
  });
  await expectNoHorizontalOverflow(page);
});

test("director exception decision flows back through accountant to a posted liability", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/finance");

  const directorCard = invoiceCard(page, "AP-TC-202607-027");
  await expect(directorCard).toContainText("Chờ giám đốc quyết định");
  await directorCard
    .getByRole("button", { name: "Chấp thuận ngoại lệ" })
    .click();
  await expect(invoiceCard(page, "AP-TC-202607-027")).toHaveCount(0, {
    timeout: REMOTE_ACTION_TIMEOUT,
  });
  await expectNoHorizontalOverflow(page);

  await logout(page);
  await login(page, "ketoan", "Ketoan@2026");
  await page.goto("/erp/finance");

  const accountantCard = invoiceCard(page, "AP-TC-202607-027");
  await expect(accountantCard).toContainText("Sẵn sàng hạch toán");
  await accountantCard.click();
  await accountantCard
    .getByRole("button", { name: "Lập công nợ và gửi kiểm tra" })
    .click();
  await expect(accountantCard).toContainText("Chờ kế toán trưởng", {
    timeout: REMOTE_ACTION_TIMEOUT,
  });

  await logout(page);
  await login(page, "ketoantruong", "Ketoantruong@2026");
  await page.goto("/erp/finance");

  const checkerCard = invoiceCard(page, "AP-TC-202607-027");
  await expect(checkerCard).toContainText("Chờ kế toán trưởng");
  await checkerCard
    .getByLabel("Kết luận kiểm soát")
    .fill("Đã kiểm tra độc lập nguồn PO, nghiệm thu và quyết định của giám đốc.");
  await checkerCard.getByRole("button", { name: "Duyệt và ghi sổ" }).click();
  await expect(checkerCard).toContainText("Đã ghi nhận công nợ", {
    timeout: REMOTE_ACTION_TIMEOUT,
  });
  await expectNoHorizontalOverflow(page);
});
