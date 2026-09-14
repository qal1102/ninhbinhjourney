import { expect, test } from "@playwright/test";
import { ERP_MANAGER_PASSWORD } from "./support/erp-credentials";
import { loginToErp } from "./support/erp-login";

/*
 * QA-DON-DU-LIEU-10 — bảng đơn trả tại điểm còn chờ thu.
 *
 * Bản chạy thử không có kho đơn đặt chỗ, nên ở đây canh điều quan trọng: quản
 * lý thấy bảng và bảng nói thật là chưa nối kho, không bày nút "Khách không
 * đến" cho một đơn không có thật. Luồng đóng khoản thật đã chạy thử trên chính
 * đơn thử của chủ dự án trong một giao dịch rồi cuộn lại (docs/HANDOFF.md).
 */
test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim()),
  "Trên production bảng này đọc đơn thật; bài này chỉ canh chế độ chưa nối kho.",
);

test("quản lý thấy bảng đơn trả tại điểm, chưa nối kho thì nói thật", async ({ page }) => {
  await loginToErp(page, "ql.trangan", ERP_MANAGER_PASSWORD);
  await page.goto("/erp/trang-an/tai-chinh-doi-soat");
  await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);

  const bang = page.locator("section").filter({ has: page.getByRole("heading", { name: "Đơn trả tại điểm còn chờ thu" }) });
  await expect(bang).toBeVisible();
  await expect(bang).toContainText("chưa nối kho đơn đặt chỗ");
  await expect(bang.getByRole("button", { name: "Khách không đến" })).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
