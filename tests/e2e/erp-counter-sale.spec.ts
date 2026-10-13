import { expect, test } from "@playwright/test";
import { ERP_DIRECTOR_PASSWORD, ERP_EMPLOYEE_PASSWORD } from "./support/erp-credentials";
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
    has: page.getByRole("heading", { name: "Ra đơn, thu tiền, đưa vé cho khách" }),
  });
  await expect(khoi).toBeVisible();
  await expect(khoi.getByText("chưa bán được vé")).toBeVisible();
  await expect(khoi.getByRole("button", { name: "Xác nhận bán" })).toHaveCount(0);

  // Kho quầy chưa nối thì phần bán nói thật là chưa bán được (cả vé đoàn, nằm
  // trong cùng khối từ 12/10/2026), còn khối vé đã bán bên cạnh vẫn mở.
  // Khối "Quy trình chốt ca vé" cũng có chữ "Vé đã bán": tìm đúng nhãn khối.
  await expect(page.locator("p").filter({ hasText: /^Vé đã bán$/ }).first()).toBeVisible();

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});

test("QA-ERP-POS-05: khu máy in nhớ khổ giấy, In thử mở hộp thoại in đúng khổ", async ({ page }) => {
  // Không có máy in thật trong máy kiểm: thay `window.print` bằng một bộ đếm.
  await page.addInitScript(() => {
    // Từ 12/10/2026 phiếu in qua một khung iframe riêng đúng khổ giấy: đếm
    // lệnh in ở cả trang chính lẫn khung, cộng dồn lên trang chính.
    const dem = window.top as unknown as { __soLanIn?: number };
    if (window === window.top) dem.__soLanIn = 0;
    window.print = () => {
      dem.__soLanIn = (dem.__soLanIn ?? 0) + 1;
    };
  });
  await loginToErp(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);

  // Quầy chưa nối kho vẫn chuẩn bị được máy in trước.
  const mayIn = page.locator("details").filter({ hasText: "Máy in phiếu thu" });
  await mayIn.locator("summary").click();
  await mayIn.getByText("A5", { exact: true }).click();
  await expect(mayIn.locator("summary")).toContainText("A5");

  await page.reload();
  await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);
  const mayInSauTaiLai = page.locator("details").filter({ hasText: "Máy in phiếu thu" });
  await expect(mayInSauTaiLai.locator("summary")).toContainText("A5");

  await mayInSauTaiLai.locator("summary").click();
  await mayInSauTaiLai.getByRole("button", { name: "In thử" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __soLanIn: number }).__soLanIn)).toBe(1);
  // Từ 12/10/2026 khổ giấy nằm trong khung in riêng, không gắn vào trang chính.
  await expect(page.locator("iframe[data-receipt-print-frame]")).toHaveCount(1);
  expect(
    await page.frameLocator("iframe[data-receipt-print-frame]").locator("style[data-receipt-page]").textContent(),
  ).toContain("size: A5");

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});

test("QA-ERP-POS-05: bảng giá quầy chỉ giám đốc vào được, chưa nối kho thì nói thật", async ({ page }) => {
  await loginToErp(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
  await page.goto("/erp/bang-gia-quay");
  await expect(page).toHaveURL(/\/erp$/);
  await page.context().clearCookies();

  await loginToErp(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/bang-gia-quay");
  await expect(page.getByRole("heading", { level: 1, name: "Bảng giá vé, quầy và web" })).toBeVisible();
  await expect(page.getByText("Bảng giá quầy chưa nối được vào kho dữ liệu ở môi trường này.")).toBeVisible();
  // Không bày nút sửa giá khi không có giá nào để sửa và không lưu được đi đâu.
  await expect(page.getByRole("button", { name: /Sửa giá/ })).toHaveCount(0);

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});
