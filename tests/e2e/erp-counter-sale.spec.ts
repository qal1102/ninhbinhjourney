import { expect, test } from "@playwright/test";
import { ERP_EMPLOYEE_PASSWORD } from "./support/erp-credentials";
import { loginToErp } from "./support/erp-login";

/*
 * QA-ERP-POS-04 — bán vé tại quầy.
 *
 * Máy cục bộ không có kho dữ liệu thật, nên ở đây chỉ canh được một điều,
 * nhưng là điều quan trọng: khi quầy chưa nối kho, màn hình phải nói thẳng
 * là chưa bán được — không bày nút "Xác nhận bán" để nhân viên thu tiền rồi
 * mới biết phiếu không lưu đi đâu cả.
 *
 * Luồng bán, huỷ và đối soát thật đã chạy thử trên production trong một giao
 * dịch rồi cuộn lại (docs/HANDOFF.md, hàng QA-ERP-POS-04). Bài này cố ý không
 * chạy trên production: ở đó nó sẽ thấy form bán thật.
 */
test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim()),
  "Trên production quầy đã nối kho, màn hình khác hẳn; bài này chỉ canh chế độ chưa nối kho.",
);

test("quầy chưa nối kho thì nói thẳng là chưa bán được, không bày nút xác nhận", async ({ page }) => {
  await loginToErp(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);

  const khoi = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Ra đơn, thu tiền mặt, đưa vé cho khách" }),
  });
  await expect(khoi).toBeVisible();
  await expect(khoi.getByText("chưa bán được vé")).toBeVisible();
  await expect(khoi.getByRole("button", { name: "Xác nhận bán" })).toHaveCount(0);

  // Khối phiếu đoàn bên dưới vẫn còn nguyên.
  await expect(page.getByRole("heading", { name: "Lập phiếu đoàn, đưa QR cho khách" })).toBeVisible();

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});
