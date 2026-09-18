import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ERP_ACCOUNTANT_PASSWORD } from "./support/erp-credentials";
import { loginToErp } from "./support/erp-login";

/*
 * A15-ERP-02 — xuất Excel và in PDF.
 *
 * Bài đơn vị đã đọc ngược cấu trúc tệp. Bài này đi đúng đường người dùng bấm
 * trong trình duyệt: tệp tải về có thật, là gói `.xlsx` (mở đầu "PK"), tên
 * chỉ có chữ ASCII; bấm in thì bản in dựng vào trang đúng lúc hộp thoại mở và
 * được gỡ sạch khi đóng — không để lại cờ làm trang khác in ra giấy trắng.
 */

async function moTaiChinh(page: Page) {
  await loginToErp(page, "ketoan", ERP_ACCOUNTANT_PASSWORD);
  await page.goto("/erp/finance");
  const nhom = page.getByRole("group", { name: /^Xuất báo cáo/ }).first();
  await expect(nhom, "màn Tài chính phải có ít nhất một thanh xuất báo cáo khi có số liệu").toBeVisible();
  return nhom;
}

test("Tải Excel trả về một tệp .xlsx thật với tên ASCII", async ({ page }) => {
  const nhom = await moTaiChinh(page);
  const [taiVe] = await Promise.all([
    page.waitForEvent("download"),
    nhom.getByRole("button", { name: "Tải Excel" }).click(),
  ]);
  expect(taiVe.suggestedFilename()).toMatch(/^[a-z0-9_.-]+\.xlsx$/);
  const duongDan = await taiVe.path();
  const bytes = readFileSync(duongDan);
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  expect(bytes.length).toBeGreaterThan(1000);
  await expect(nhom.getByRole("alert")).toHaveCount(0);
});

test("In / Lưu PDF dựng bản in lúc mở hộp thoại và gỡ sạch khi đóng", async ({ page }) => {
  const nhom = await moTaiChinh(page);
  await page.evaluate(() => {
    const w = window as typeof window & { __banIn?: { co: boolean; soBanIn: number; soBang: number } };
    w.print = () => {
      w.__banIn = {
        co: document.documentElement.hasAttribute("data-erp-printing"),
        soBanIn: document.querySelectorAll("body > [data-erp-print-root]").length,
        soBang: document.querySelectorAll("[data-erp-print-root] table").length,
      };
    };
  });
  await expect(page.locator("[data-erp-print-root]")).toHaveCount(0);

  await nhom.getByRole("button", { name: "In / Lưu PDF" }).click();
  const luc = await page.evaluate(() => (window as typeof window & { __banIn?: unknown }).__banIn);
  expect(luc).toEqual({ co: true, soBanIn: 1, soBang: expect.any(Number) });
  expect((luc as { soBang: number }).soBang).toBeGreaterThan(0);
  // Trên màn hình bản in vẫn ẩn; chỉ CSS in mới bày nó ra.
  await expect(page.locator("[data-erp-print-root]")).toBeHidden();

  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("[data-erp-print-root]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-erp-printing"))).toBe(false);
});
