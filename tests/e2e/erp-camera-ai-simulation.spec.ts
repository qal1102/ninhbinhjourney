import { expect, test, type Page } from "@playwright/test";

// Camera AI — kịch bản mô phỏng (T17, docs/HANDOFF.md).
//
// Chạy trên máy cục bộ ở chế độ demo-cookie. Spec này chỉ đọc và không gọi
// hành động ghi nào, nên nó không để lại gì kể cả khi trỏ vào môi trường thật.
//
// Ba điều cần chứng minh và đều không thể chứng minh bằng unit test:
//  1. Màn hình tự nhận mình là mô phỏng, ngay ở chỗ dễ đọc nhất.
//  2. Kịch bản sự kiện chỉ chạy cho giám đốc.
//  3. Số không nhảy khi tải lại trang trong cùng một khung 5 phút — đây là
//     khác biệt thật sự so với bản cũ, vốn bịa số mới mỗi lần render.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel(/Tên đăng nhập|Email hoặc tên đăng nhập/).fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  // Trên production đây là một vòng gọi Supabase thật; chạy song song nhiều
  // worker thì 8 giây mặc định của expect không đủ.
  await expect(page).toHaveURL(/\/erp$/, { timeout: 25_000 });
}

async function readCameraCounts(page: Page) {
  return page
    .locator("button p.text-xl.font-black")
    .allInnerTexts();
}

test("màn hình camera tự khai báo là mô phỏng và không hứa số đo", async ({ page }) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/trang-an/camera-ai");

  await expect(page.getByText("Kịch bản mô phỏng").first()).toBeVisible();
  await expect(
    page.getByText(/mọi số trên màn hình này là mô hình, không phải số đo/),
  ).toBeVisible();
  // Thẻ độ trễ không được bịa một con số giây khi chưa có luồng hình thật.
  await expect(page.getByText("Chưa nối luồng hình thật")).toBeVisible();
});

test("số người giữ nguyên khi tải lại trang trong cùng khung thời gian", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/trang-an/camera-ai");
  const first = await readCameraCounts(page);
  expect(first.length).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByText("Kịch bản mô phỏng").first()).toBeVisible();
  expect(await readCameraCounts(page)).toEqual(first);
});

test("kịch bản sự kiện chỉ chạy cho giám đốc", async ({ page }) => {
  test.setTimeout(60_000);

  // Quản lý: không có sự kiện dựng sẵn nào, và màn hình nói rõ vì sao.
  await login(page, "ql.vanhanh", "Quanly@2026");
  await page.goto("/erp/trang-an/camera-ai");
  await expect(
    page.getByText(/Kịch bản mô phỏng chỉ chạy trên tài khoản giám đốc/),
  ).toBeVisible();
  await expect(page.getByText(/sự kiện · dừng sau khi đủ/)).toHaveCount(0);

  await page.context().clearCookies();

  // Giám đốc: đúng một sự kiện xuất hiện sau ~12 giây, và bộ đếm dừng ở 2.
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/trang-an/camera-ai");
  await expect(page.getByText("0/2 sự kiện · dừng sau khi đủ")).toBeVisible();
  await expect(page.getByText("1/2 sự kiện · dừng sau khi đủ")).toBeVisible({
    timeout: 25_000,
  });
  await expect(
    page.getByText(/kịch bản, không tạo hồ sơ sự cố/).first(),
  ).toBeVisible();
});

test("không còn nút tạo sự cố từ camera", async ({ page }) => {
  // Số mô phỏng không được phép trở thành hồ sơ sự cố thật. Đây là lỗi đã
  // từng có và bị khoá lại; spec này giữ cho nó không quay về.
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/trang-an/camera-ai");
  await expect(page.getByRole("button", { name: /tạo sự cố|báo sự cố/i })).toHaveCount(0);
});
