import { expect, test, type Page } from "@playwright/test";
import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

// Trợ lý ghi việc (06/10/2026): câu nói thành bản nháp, xem lại rồi lưu.
//
// Phần nghe giọng nói dùng Web Speech API, Chromium headless không có dịch vụ
// nhận dạng; bài gõ đúng câu ấy vào ô, đi qua cùng đường hiểu câu và lưu.
// Bảng việc không có hàm xoá (cố ý), nên bài chỉ chạy ở máy với kho tạm.
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim()), "Ghi việc và ghi chú; chỉ chạy cục bộ.");

async function login(page: Page) {
  await page.goto("/erp/login");
  await page.getByLabel(/Tên đăng nhập|Email hoặc tên đăng nhập/).fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/, { timeout: 25_000 });
}

test("nói một câu giao việc: bản nháp điền sẵn người nhận và hạn, lưu xong hiện trong việc đã giao", async ({ page }) => {
  await login(page);
  await page.goto("/erp/viec");
  const viec = `Kiểm lại áo phao bến Văn Lâm ${Date.now().toString(36)}`;
  await page.getByTestId("o-ghi-nhanh").fill(`Giao cho quản lý Tam Cốc sáng mai ${viec} trước 9 giờ gấp nhé`);
  await page.getByRole("button", { name: "Viết nháp" }).click();

  const nhap = page.getByTestId("the-ban-nhap");
  await expect(nhap).toBeVisible();
  await expect(nhap.getByRole("radio", { name: "Giao việc" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("noi-dung-nhap")).toHaveValue(viec);
  await expect(page.getByTestId("nguoi-nhan-nhap").locator("option:checked")).toContainText("Quản lý");
  await expect(page.getByTestId("han-nhap")).toHaveValue(/T09:00$/);
  await expect(nhap.getByLabel("Việc khẩn")).toBeChecked();

  await page.getByTestId("luu-ban-nhap").click();
  await expect(page.getByTestId("thong-bao-ghi")).toContainText("Đã giao cho");
  const dong = page.locator("[data-viec-ghi]", { hasText: viec });
  await expect(dong).toBeVisible();
  await expect(dong).toContainText("Hạn 09:00 ngày mai");

  await dong.getByRole("button", { name: "Huỷ việc" }).click();
  await expect(page.locator("details", { hasText: "Đã xong hoặc đã huỷ" })).toBeVisible();
});

test("câu ghi chú trong trợ lý ở thanh đầu trang thành bản nháp ngay trong hội thoại", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Mở trợ lý điều hành" }).click();
  const hoi = page.getByRole("dialog", { name: "Bạn cần gì?" });
  await hoi.getByPlaceholder("Ví dụ: Ghi chú gọi lại nhà in vé").fill("Ghi chú gọi lại nhà in vé chiều nay");
  await hoi.getByRole("button", { name: "Gửi lệnh" }).click();
  await expect(hoi.getByTestId("noi-dung-nhap")).toHaveValue("Gọi lại nhà in vé");
  await hoi.getByTestId("luu-ban-nhap").click();
  await expect(hoi.getByTestId("nhap-da-xong")).toContainText("Đã lưu ghi chú");
  await expect(hoi.getByRole("link", { name: /Mở Việc & ghi chú/ })).toHaveAttribute("href", "/erp/viec");
});
