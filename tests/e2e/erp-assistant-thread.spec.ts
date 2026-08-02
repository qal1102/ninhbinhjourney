import { expect, test, type Page } from "@playwright/test";

// Trợ lý điều hành — luồng hội thoại (kiểu tin nhắn thoại).
//
// Phần nhận giọng nói dùng Web Speech API của trình duyệt, không kiểm thử tự
// động được: Chromium headless không có đường ra dịch vụ nhận dạng. Spec này
// kiểm phần còn lại — cùng một hàm `execute` mà giọng nói gọi vào: nhận ra từ
// khoá, mở đúng màn hình, và giữ lại lịch sử để mở trợ lý ra là thấy.
//
// Chỉ đọc và điều hướng, không ghi gì.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel(/Tên đăng nhập|Email hoặc tên đăng nhập/).fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  // Trên production đây là một vòng gọi Supabase thật; chạy song song nhiều
  // worker thì 8 giây mặc định của expect không đủ.
  await expect(page).toHaveURL(/\/erp$/, { timeout: 25_000 });
}

async function openAssistant(page: Page) {
  await page.getByRole("button", { name: "Mở trợ lý điều hành" }).click();
  await expect(page.getByRole("dialog", { name: /Bạn cần mở màn hình nào/ })).toBeVisible();
}

test("lệnh mở màn hình được ghi lại thành hội thoại và còn đó sau khi chuyển trang", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await openAssistant(page);

  await page.getByPlaceholder("Ví dụ: Mở tài chính tổng hợp").fill("Mở camera Tam Chúc");
  await page.getByRole("button", { name: "Gửi lệnh" }).click();

  // Từ khoá được nhận ra và màn hình mở thẳng ra, không cần bấm thêm.
  await expect(page).toHaveURL(/\/erp\/tam-chuc\/camera-ai/);

  // Mở lại trợ lý: thấy đúng câu vừa gửi và việc hệ thống đã làm. Khoanh vào
  // đúng khối hội thoại, vì chuỗi này còn xuất hiện ở gợi ý lệnh nhanh và ở
  // dòng ví dụ dưới nút micro.
  await openAssistant(page);
  const thread = page.getByTestId("assistant-thread");
  await expect(thread.getByText("Mở camera Tam Chúc")).toBeVisible();
  await expect(thread.getByText(/Đã mở .*Tam Chúc/)).toBeVisible();
  await expect(thread.getByText("Lệnh nhập")).toBeVisible();
});

test("câu hỏi số liệu trả lời trong hội thoại thay vì chuyển trang", async ({ page }) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await openAssistant(page);

  await page.getByRole("button", { name: "Hôm nay doanh thu bao nhiêu?" }).click();

  await expect(page.getByText("Hôm nay doanh thu bao nhiêu?").last()).toBeVisible();
  // Số đến từ ca đã chốt; nếu chưa có ca nào thì trợ lý phải nói thẳng như vậy
  // chứ không dựng một con số.
  await expect(
    page.getByText(/doanh thu thuần|Chưa có ca nào được chốt/),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/erp$/);
});

test("xoá hội thoại dọn sạch luồng", async ({ page }) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await openAssistant(page);

  await page.getByPlaceholder("Ví dụ: Mở tài chính tổng hợp").fill("Cơ sở nào đang quá tải?");
  await page.getByRole("button", { name: "Gửi lệnh" }).click();
  await expect(page.getByText("Mở màn hình sức chứa để xem theo cơ sở")).toBeVisible();

  await page.getByRole("button", { name: "Xoá hội thoại" }).click();
  await expect(page.getByText("Mở màn hình sức chứa để xem theo cơ sở")).toHaveCount(0);
  await expect(page.getByText(/Giữ micro và nói bình thường/)).toBeVisible();
});
