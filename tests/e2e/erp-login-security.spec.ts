import { expect, test } from "@playwright/test";

/*
 * QA-P2-09 (ERP) — màn hình đăng nhập.
 *
 * Lượt kiểm 12/09/2026 thấy trang đăng nhập công khai đủ tên đăng nhập và
 * không giới hạn số lần nhập sai.
 */

test("trang đăng nhập không liệt kê tên đăng nhập nào khi không bật chế độ trình diễn mật khẩu", async ({ page }) => {
  test.skip(
    process.env.NEXT_PUBLIC_ERP_SHOW_DEMO_PASSWORDS === "true",
    "Chế độ trình diễn cố ý hiện cả tên lẫn mật khẩu.",
  );
  await page.goto("/erp/login");
  await expect(page.getByRole("button", { name: "Mở hệ thống quản lý" })).toBeVisible();
  const chu = await page.locator("main").innerText();
  for (const ten of ["giamdoc", "nv.trangan", "ql.trangan", "ketoan"]) {
    expect(chu, ten).not.toContain(ten);
  }
  await expect(page.getByText("Tài khoản đăng nhập được cấp")).toHaveCount(0);
});

test("nhập sai 5 lần thì báo khoá bằng tiếng Việt, kể cả khi lần thứ sáu gõ gì", async ({ page }, testInfo) => {
  // Bài này ghi lượt sai vào bộ đếm, nên không chạy trên production.
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim()), "Ghi lượt đăng nhập sai; chỉ chạy cục bộ.");
  // Mỗi lượt chạy giả một địa chỉ máy riêng, để bộ đếm theo máy không khoá
  // chân các bài đăng nhập khác của cả bộ kiểm đang dùng chung 127.0.0.1.
  const may = `198.51.100.${(Date.now() % 200) + (testInfo.project.name.startsWith("mobile") ? 1 : 50)}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": may });
  const ten = `khong-co-that-${testInfo.project.name}-${Date.now()}`;

  for (let lan = 1; lan <= 5; lan++) {
    await page.goto("/erp/login");
    // Chờ trang gắn xong trình xử lý, để không mất cú bấm (xem tests/e2e/support/erp-login.ts).
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/Email hoặc tên đăng nhập/).fill(ten);
    await page.getByLabel("Mật khẩu").fill(`sai-${lan}`);
    await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
    await expect(page).toHaveURL(/error=invalid/);
  }

  await page.goto("/erp/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/Email hoặc tên đăng nhập/).fill(ten);
  await page.getByLabel("Mật khẩu").fill("sai-6");
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/error=locked/);
  await expect(page.getByRole("alert")).toContainText("Nhập sai quá nhiều lần");
  await expect(page.getByRole("alert")).toContainText("phút");
});
