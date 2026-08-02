import { expect, test, type Page } from "@playwright/test";

// T14b — danh bạ nhân sự đọc từ registry.
//
// Điều cần chứng minh không thể chứng minh bằng unit test: một người **chỉ tồn
// tại trong registry** (do giám đốc tạo trên `/erp/tai-khoan`, chưa từng có
// trong mã nguồn) phải hiện ra ở màn hình phân quyền module, phải nhận được
// module, và phải xem thử được. Trước T14b cả ba đều không xảy ra: hai màn hình
// đó còn liệt kê từ `DEMO_ERP_ACCOUNTS`.
//
// Tự dọn dẹp (AGENTS.md): tài khoản do chính spec tạo ra và bị chuyển
// `suspended` ở cuối. Không có API xoá tài khoản — theo thiết kế, tài khoản
// được lưu vết chứ không xoá — nên `suspended` là trạng thái cuối cố ý để lại.
// Phiếu cấp module và dòng nhật ký xem-thử đi kèm tài khoản đó, và đều thuộc
// một tài khoản đã khoá: không có gì nằm chờ trong hàng việc của ai.

async function loginLegacy(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Email hoặc tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/, { timeout: 25_000 });
}

async function logout(page: Page) {
  const mobileMenu = page.getByRole("button", { name: "Mở menu" });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
  }
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/erp\/login/, { timeout: 25_000 });
}

test("một người chỉ có trong registry hiện ra ở phân quyền module và xem thử được", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const accountId = `qa-t14b-${stamp}`;
  const displayName = `QA T14b ${stamp}`;

  await loginLegacy(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/tai-khoan");

  // 1. Tạo tài khoản — chưa từng tồn tại trong mã nguồn.
  const createDetails = page.locator("details").filter({
    has: page.locator('input[name="accountId"]'),
  });
  await createDetails.locator("summary").click();
  await createDetails.locator('input[name="accountId"]').fill(accountId);
  await createDetails.locator('input[name="displayName"]').fill(displayName);
  await createDetails.locator('input[name="jobTitle"]').fill("Kiểm tra danh bạ T14b");
  await createDetails.getByRole("button", { name: "Lưu tài khoản" }).click();
  await expect(page.getByText(`Đã lưu tài khoản ${accountId}.`)).toBeVisible({
    timeout: 20_000,
  });

  const card = page
    .locator("article")
    .filter({ has: page.getByText(accountId, { exact: true }) });
  await card.locator('select[name="role"]').selectOption("employee");
  await card.locator('select[name="siteId"]').selectOption("trang-an");
  await card.getByRole("button", { name: "Cấp", exact: true }).click();
  await expect(card.getByText(`Đã cấp vai trò cho ${accountId}.`)).toBeVisible({
    timeout: 20_000,
  });

  // 2. Màn hình phân quyền module phải thấy người này. Đây là khẳng định đã
  // thất bại trước T14b.
  await page.goto("/erp/trang-an/nhan-su");
  const staffCard = page
    .locator("details")
    .filter({ has: page.getByText(displayName, { exact: true }) });
  await expect(staffCard).toBeVisible({ timeout: 20_000 });

  // 3. Chưa có hồ sơ đào tạo thì màn hình phải nói thẳng ra, không im lặng.
  await staffCard.locator("summary").click();
  await expect(
    staffCard.getByText(/chưa có hồ sơ đào tạo/),
  ).toBeVisible();

  // 4. Giao được việc thật: gán cơ sở + một nghiệp vụ, rồi lưu.
  await staffCard.locator('input[name="siteActive"]').check();
  await staffCard.locator('input[name="moduleIds"]').first().check();
  await staffCard.getByRole("button", { name: "Lưu phân công" }).click();
  await expect(page.getByText(displayName, { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });

  await page.screenshot({
    path: testInfo.outputPath("prod-t14b-staff-listed.png"),
    fullPage: true,
  });

  // 5. Xem thử: tài khoản phải có mặt trong danh sách và chuyển phiên được.
  // `startRoleSwitch` trước đây tra qua `findDemoErpAccountById`, nên bước này
  // sẽ báo "Không tìm thấy tài khoản để xem thử" dù danh sách có hiện tên.
  const switcher = page.locator("details").filter({
    has: page.locator('select[name="targetUserId"]'),
  });
  await switcher.first().locator("summary").click();
  const targetSelect = switcher.first().locator('select[name="targetUserId"]');
  await expect(
    targetSelect.locator(`option[value="${accountId}"]`),
  ).toHaveCount(1);
  await targetSelect.selectOption(accountId);
  await switcher.first().getByRole("button", { name: "Xem thử" }).click();

  await expect(page.getByText(`Nhân viên · ${displayName}`)).toBeVisible({
    timeout: 25_000,
  });

  // 6. Trả phiên về giám đốc — không để lại một phiên mạo danh đang mở.
  await page.getByRole("button", { name: "Quay lại giám đốc" }).click();
  await expect(page.getByText(/Đang xem với vai trò/)).toHaveCount(0, {
    timeout: 25_000,
  });

  // 7. Dọn dẹp.
  await page.goto("/erp/tai-khoan");
  const cleanupCard = page
    .locator("article")
    .filter({ has: page.getByText(accountId, { exact: true }) });
  await cleanupCard.getByRole("button", { name: "Tạm khoá tài khoản" }).click();
  await expect(
    cleanupCard.getByText(`Đã khoá tài khoản ${accountId}.`),
  ).toBeVisible({ timeout: 20_000 });

  // Đã khoá thì phải biến khỏi danh sách xem thử ngay.
  await page.goto("/erp");
  const cleanSwitcher = page.locator("details").filter({
    has: page.locator('select[name="targetUserId"]'),
  });
  await cleanSwitcher.first().locator("summary").click();
  await expect(
    cleanSwitcher.first().locator(`option[value="${accountId}"]`),
  ).toHaveCount(0);

  await logout(page);
});
