import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

async function logout(page: import("@playwright/test").Page) {
  const mobileMenu = page.getByRole("button", { name: "Mở menu" });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
  }
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/erp\/login/);
}

test("director sees each operating site as a separate branch", async ({ page }, testInfo) => {
  await page.goto("/erp");
  await expect(page).toHaveURL(/\/erp\/login/);
  await login(page, "giamdoc", "Giamdoc@2026");

  await expect(page.getByRole("heading", { level: 1, name: /11\.450 khách dự kiến · 1,84 tỷ doanh thu/ })).toBeVisible();
  await expect(page.getByText("Toàn vùng · 4 cơ sở · 28/07/2026", { exact: true })).toBeVisible();
  await expect(page.getByText("Nhật ký gần đây", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ngân sách, tiến độ và mốc gần nhất" })).toBeVisible();
  await expect(page.getByText("Khách dự kiến cả ngày", { exact: true })).toBeVisible();
  await expect(page.getByText("Chi phí ghi nhận", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /\d+ hồ sơ cần xử lý/ })).toBeVisible();
  await expect(page.getByText("Dự án & sự kiện", { exact: true })).toBeVisible();
  await expect(page.getByText("DEC-TC-028", { exact: true })).toBeVisible();
  await expect(page.getByText("Việc sắp đến hạn", { exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/erp/trang-an"]').first()).toBeVisible();
  await expect(page.locator('a[href="/erp/tam-chuc"]').first()).toBeVisible();
  await expect(page.locator('a[href="/erp/tam-coc"]').first()).toBeVisible();
  await expect(page.locator('a[href="/erp/bai-dinh"]').first()).toBeVisible();

  await page.goto("/erp/bai-dinh");
  await expect(page).toHaveURL(/\/erp\/bai-dinh$/);
  await expect(page.getByRole("heading", { level: 1, name: "Bái Đính" })).toBeVisible();
  if (!testInfo.project.name.startsWith("mobile")) {
    const moduleNavigation = page.getByRole("navigation", { name: "Module Bái Đính" });
    await expect(moduleNavigation.locator("summary").filter({ hasText: "Booking" })).toBeVisible();
    await expect(moduleNavigation.locator("summary").filter({ hasText: "Hiện trường" })).toBeVisible();
    await expect(moduleNavigation.locator("summary").filter({ hasText: "An toàn" })).toBeVisible();
    await expect(moduleNavigation.getByRole("link", { name: "Dự án" })).toBeVisible();
    await moduleNavigation.locator("summary").filter({ hasText: "Tài chính" }).click();
    await expect(moduleNavigation.getByRole("link", { name: "Tài chính & đối soát" })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /Camera AI & hiện trường/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Dự án & sự kiện/ })).toBeVisible();

  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.getByRole("heading", { name: "Hôm nay" })).toBeVisible();
  await expect(page.getByText("Từ mã QR đến đối soát")).toBeVisible();
  await expect(page.getByText("Chờ phê duyệt", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Việc sắp đến hạn", { exact: true })).toHaveCount(0);
});

test("director compares finance periods and opens only the selected metric detail", async ({ page }, testInfo) => {
  await login(page, "giamdoc", "Giamdoc@2026");

  await expect(page.getByRole("heading", { name: "Tài chính hợp nhất" })).toBeVisible();
  await expect(page.getByRole("region", { name: /Chi tiết/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Tháng", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tháng · Tháng 7/2026" })).toBeVisible();

  const revenue = page.getByRole("button").filter({ hasText: "38,6 tỷ" });
  await revenue.click();
  const revenueDetail = page.getByRole("region", { name: "Chi tiết Doanh thu" });
  await expect(revenueDetail).toContainText("Tháng trước");
  await expect(revenueDetail).toContainText("Cùng tháng năm trước");
  await expect(revenueDetail).toContainText("Vé tham quan");
  await expect(revenueDetail).toContainText("Nguồn:");

  await page.getByRole("button").filter({ hasText: "13,6 tỷ" }).click();
  await expect(page.getByRole("region", { name: "Chi tiết Lợi nhuận vận hành" })).toContainText("Tràng An");
  await expect(revenueDetail).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("finance-overview-month.png"), fullPage: true });
});

test("director can open an AI camera view and delegate a field check", async ({ page }) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/tam-chuc/camera-ai");

  await expect(page.getByRole("heading", { level: 1, name: "Camera AI & hiện trường" })).toBeVisible();
  await expect(page.getByText("Camera theo khu vực")).toBeVisible();
  await page.getByRole("button", { name: /CAM 02/ }).click();
  await expect(page.getByRole("dialog", { name: /Camera Bến thuyền/ })).toBeVisible();
  await page.getByRole("button", { name: "Giao quản lý kiểm tra" }).click();
  await expect(page.getByRole("status")).toContainText("Đã giao quản lý Tam Chúc");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("director can track an event project with budget, deadline and urgent work", async ({ page }) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/trang-an/du-an-su-kien");
  await expect(page.getByRole("heading", { level: 1, name: "Dự án & sự kiện" })).toBeVisible();
  await expect(page.getByText("Lễ hội Tràng An 2026")).toBeVisible();
  await expect(page.getByText("12,8 tỷ")).toBeVisible();
  await expect(page.getByText("Việc đã chuyển cấp")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("employee is blocked from another site and can check attendance by GPS", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 20.25245, longitude: 105.91755 });
  await login(page, "nv.trangan", "Nhanvien@2026");

  await expect(page.locator('a[href^="/erp/trang-an/"]').first()).toBeVisible();
  await expect(page.locator('a[href^="/erp/tam-chuc/"]')).toHaveCount(0);

  await page.goto("/erp/tam-chuc");
  await expect(page).toHaveURL(/\/erp\?denied=site/);
  await expect(page.locator('p[role="alert"]')).toContainText("chưa được phân công");

  await page.goto("/erp/trang-an/nhan-su");
  await expect(page).toHaveURL(/\/erp\/trang-an\?denied=module/);
  await expect(page.locator('p[role="alert"]')).toContainText("chưa được mở");

  await page.goto("/erp/trang-an/cham-cong");
  await page.getByRole("button", { name: /Xác nhận ra ca bằng GPS/ }).click();
  await expect(page.getByRole("status")).toContainText("Đã ghi nhận ra ca");
});

test("accountant works from a real source-to-ledger queue without field-control actions", async ({ page }, testInfo) => {
  await login(page, "ketoan", "Ketoan@2026");

  await expect(page.getByText("Bàn làm việc kế toán", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Phạm Thu Trang" })).toBeVisible();
  await expect(page.locator('a[href="/erp/trang-an/tai-chinh-doi-soat"]').first()).toBeVisible();
  await expect(page.locator('a[href="/erp/tam-chuc/tai-chinh-doi-soat"]').first()).toBeVisible();
  await expect(page.getByText("Ca của tôi", { exact: true })).toHaveCount(0);

  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Mở menu" }).click();
    await expect(page.getByRole("link", { name: /Sổ kế toán & đối soát/ })).toBeVisible();
    await page.getByRole("link", { name: /Sổ kế toán & đối soát/ }).click();
  } else {
    await page.goto("/erp/finance");
  }

  await expect(page.getByRole("heading", { level: 1, name: "Chứng từ & đối soát" })).toBeVisible();
  const payableCase = page.locator("details").filter({ hasText: "AP-TC-011" });
  await payableCase.locator("summary").click();
  await expect(payableCase).toContainText("Định khoản đề xuất");
  await expect(payableCase).toContainText("Nợ = Có");
  await expect(payableCase).toContainText("Biên bản nghiệm thu");
  await payableCase.getByRole("button", { name: "Gửi người kiểm tra" }).click();
  await expect(page.getByRole("status")).toContainText("AP-TC-011 · Gửi người kiểm tra");

  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.getByRole("heading", { level: 1, name: "Vé & đặt chỗ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi quản lý xác nhận" })).toHaveCount(0);

  await page.goto("/erp/trang-an/doi-tac-nha-cung-ung");
  await expect(page.getByRole("button", { name: "Tạo báo giá nháp" })).toHaveCount(0);

  await page.goto("/erp/trang-an/bao-cao-hien-truong");
  await expect(page.getByRole("button", { name: "Gửi báo cáo" })).toHaveCount(0);

  await page.goto("/erp/tam-chuc/camera-ai");
  await expect(page).toHaveURL(/\/erp\/tam-chuc\?denied=module/);
  await page.goto("/erp/trang-an/nhan-su");
  await expect(page).toHaveURL(/\/erp\/trang-an\?denied=module/);

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("seasonal employee gets expiring trained-only access and manager can see the boundary", async ({ page }) => {
  await login(page, "tv.trangan", "Thoivu@2026");
  await expect(page.getByText("Nhân viên thời vụ · Tràng An", { exact: true })).toBeVisible();
  await expect(page.getByText(/Quyền làm việc có hiệu lực đến 31\/08\/2026/)).toBeVisible();
  await expect(page.getByText("08:00–12:00", { exact: true })).toBeVisible();
  await expect(page.locator('a[href="/erp/trang-an/check-in-khach"]').first()).toBeVisible();
  await expect(page.locator('a[href="/erp/trang-an/ve-dat-cho"]')).toHaveCount(0);
  await expect(page.locator('a[href="/erp/trang-an/camera-ai"]')).toHaveCount(0);
  await page.goto("/erp/tam-chuc");
  await expect(page).toHaveURL(/\/erp\?denied=site/);

  await logout(page);
  await login(page, "ql.trangan", "Quanly@2026");
  await page.goto("/erp/trang-an/nhan-su");
  const seasonalRecord = page.locator("details").filter({ hasText: "tv.trangan" });
  await expect(seasonalRecord.getByText("Thời vụ", { exact: true })).toBeVisible();
  await seasonalRecord.locator("summary").click();
  await expect(seasonalRecord.getByLabel("Khách", { exact: true })).toBeVisible();
  await expect(seasonalRecord.getByLabel("Vé", { exact: true })).toHaveCount(0);
});

test("ERP exposes an installable manifest and service worker", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.start_url).toBe("/erp");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192" }),
    expect.objectContaining({ sizes: "512x512" }),
  ]));

  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.ok()).toBeTruthy();
  expect(await workerResponse.text()).toContain("notificationclick");
});

test("mobile director can use the hamburger, finance drill-down and voice command", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile navigation check");
  await login(page, "giamdoc", "Giamdoc@2026");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Mở menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu điều hành" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tài chính toàn vùng/ })).toBeVisible();
  await page.getByRole("link", { name: /Tài chính toàn vùng/ }).click();
  await expect(page).toHaveURL(/\/erp\/finance$/);
  await expect(page.getByText("Doanh thu & hiệu quả")).toBeVisible();
  await expect(page.getByText("Chi phí đã ghi nhận", { exact: true })).toBeVisible();
  await expect(page.getByText("Phải trả đến hạn", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Mở trợ lý điều hành" }).click();
  await expect(page.getByRole("dialog", { name: "Bạn cần mở màn hình nào?" })).toBeVisible();
  const command = page.getByPlaceholder("Ví dụ: Mở tài chính tổng hợp");
  await command.fill("Hôm nay doanh thu bao nhiêu?");
  await page.getByRole("button", { name: "Gửi lệnh" }).click();
  await expect(page.getByText("1,84 tỷ đồng")).toBeVisible();

  await command.fill("Mở camera Bến thuyền Tam Chúc");
  await page.getByRole("button", { name: "Gửi lệnh" }).click();
  await expect(page).toHaveURL(/\/erp\/tam-chuc\/camera-ai\?camera=02$/);
  await expect(page.getByRole("dialog", { name: "Camera Bến thuyền" })).toBeVisible();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();

  await page.getByRole("button", { name: "Mở trợ lý điều hành" }).click();
  await page.getByPlaceholder("Ví dụ: Mở tài chính tổng hợp").fill("Mở nhân sự Bái Đính");
  await page.getByRole("button", { name: "Gửi lệnh" }).click();
  await expect(page).toHaveURL(/\/erp\/bai-dinh\/nhan-su$/);
});

test("mobile site menu groups work by operating function", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile navigation check");
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/bai-dinh");
  await page.getByRole("button", { name: "Mở menu" }).click();

  const menu = page.getByRole("dialog", { name: "Menu điều hành" });
  await expect(menu.getByRole("heading", { name: "Booking & Check-in" })).toBeVisible();
  await expect(menu.getByRole("heading", { name: "Điều hành hiện trường" })).toBeVisible();
  await expect(menu.getByRole("heading", { name: "Tài chính & báo cáo" })).toBeVisible();
  await menu.getByRole("link", { name: "Camera AI & hiện trường" }).click();
  await expect(page).toHaveURL(/\/erp\/bai-dinh\/camera-ai$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("mobile voice recognition opens the requested event project", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile voice pipeline check");
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.evaluate(() => {
    class MockRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onresult: ((event: { results: Array<{ 0: { transcript: string } }> }) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        this.onstart?.();
        window.setTimeout(() => {
          this.onresult?.({ results: [{ 0: { transcript: "Mở dự án lễ hội Tràng An" } }] });
          this.onend?.();
        }, 0);
      }
      stop() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { value: MockRecognition, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: MockRecognition, configurable: true });
  });
  await page.getByRole("button", { name: "Mở trợ lý điều hành" }).click();
  await page.getByRole("button", { name: /Nói để mở nhanh/ }).click();
  await expect(page).toHaveURL(/\/erp\/trang-an\/du-an-su-kien$/);
});

test("manager grants a module and the employee receives it on the next login", async ({
  page,
}, testInfo) => {
  await login(page, "ql.trangan", "Quanly@2026");
  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.getByRole("heading", { name: "Hôm nay" })).toBeVisible();
  const managerShiftQueue = page.getByRole("region", { name: "Quy trình chốt ca vé" });
  await expect(managerShiftQueue.getByRole("heading", { name: /ca chờ xác nhận/ })).toBeVisible();
  await page.goto("/erp/trang-an/nhan-su");

  const accessPanel = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Đội ngũ Tràng An" }),
  });
  const employee = accessPanel.locator("details").filter({ hasText: "nv.trangan" });
  await employee.locator("summary").click();
  await employee.getByLabel("Vé", { exact: true }).check();
  await employee.getByRole("button", { name: "Lưu phân công" }).click();
  await expect(employee.getByLabel("Vé", { exact: true })).toBeChecked();

  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Mở menu" }).click();
  }
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/erp\/login/);
  await login(page, "nv.trangan", "Nhanvien@2026");
  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.getByRole("heading", { level: 1, name: "Vé & đặt chỗ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gửi chốt vé và tiền thu" })).toBeVisible();
});

test("employee submits an image-backed field report with accounting trace", async ({ page }) => {
  await login(page, "nv.trangan", "Nhanvien@2026");
  await page.goto("/erp/trang-an/bao-cao-hien-truong");

  await expect(page.getByRole("heading", { level: 1, name: "Báo cáo hiện trường" })).toBeVisible();
  await page.getByPlaceholder("Ví dụ: Kiểm tra máy quét cổng A").fill("Kiểm tra cổng quét vé đoàn");
  await page.getByPlaceholder("OPS-GATE-A").fill("OPS-GATE-GROUP");
  await page.locator('select[name="progress"]').selectOption("100");
  await page.locator('input[type="file"]').setInputFiles({
    name: "cong-ve-a.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await page.getByPlaceholder("Đã làm được gì, còn thiếu gì, cần ai hỗ trợ?").fill("Máy quét ổn định, đã đối chiếu đủ 42 khách đoàn.");
  await page.getByRole("button", { name: "Gửi báo cáo" }).click();
  await expect(page.getByRole("status")).toContainText("Đã ghi nhận IMG-");
  await page.getByRole("button", { name: /Kiểm tra cổng quét vé đoàn/ }).click();
  await expect(page.getByRole("dialog", { name: /Báo cáo IMG-/ })).toContainText("OPS-GATE-GROUP");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("manager can record QR, inspect comparisons and review an employee shift", async ({ page }) => {
  await login(page, "ql.trangan", "Quanly@2026");
  await page.goto("/erp/trang-an/check-in-khach");
  await page.getByPlaceholder("Đưa mã vào máy quét hoặc nhập mã QR").fill("QR-TEST-2026-001");
  await page.getByRole("button", { name: "Xác thực & ghi nhận" }).click();
  await expect(page.getByRole("status")).toContainText("Đã ghi nhận QR-TEST-2026-001");

  await page.getByRole("button", { name: "Năm", exact: true }).click();
  await expect(page.getByText("+15,3% so với bình quân năm 2023–2025")).toBeVisible();

  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.getByRole("button", { name: "Gửi quản lý xác nhận" })).toHaveCount(0);
  const shift = page.locator("details").filter({ hasText: "SC-TA-20260728-01" });
  await shift.locator("summary").click();
  await shift.getByPlaceholder("Kết quả kiểm quỹ, POS/QR và chứng từ ca").fill(
    "Đã kiểm quỹ và đối chiếu POS/QR, số liệu khớp biên bản ca.",
  );
  await shift.getByRole("button", { name: "Xác nhận & chuyển kế toán" }).click();
  await expect(shift).toContainText("Chờ kế toán");
  await expect(
    shift.getByRole("button", { name: "Xác nhận & chuyển kế toán" }),
  ).toHaveCount(0);
});

test("ticket shift follows employee to manager and accounting without duplicate entry", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "The same workflow is covered once on desktop; mobile layout has separate overflow coverage.",
  );
  test.setTimeout(60_000);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 20.25245, longitude: 105.91755 });

  await login(page, "nv.trangan", "Nhanvien@2026");
  await page.goto("/erp/trang-an/cham-cong");
  await page.getByRole("button", { name: "Xác nhận ra ca bằng GPS" }).click();
  await expect(page.getByRole("status")).toContainText("Đã ghi nhận ra ca");
  await page.getByRole("button", { name: "Xác nhận vào ca bằng GPS" }).click();
  await expect(page.getByRole("status")).toContainText("Đã ghi nhận vào ca");

  await page.goto("/erp/trang-an/ve-dat-cho");
  await page.getByLabel("Số vé đã bán").fill("462");
  await page.getByLabel("Doanh thu trên hệ thống").fill("79400000");
  await page.getByLabel("Tiền mặt kiểm đếm").fill("32000000");
  await page.getByLabel("Thẻ/QR/chuyển khoản").fill("29400000");
  await page.getByLabel("Tiền hoàn vé").fill("0");
  await page.getByLabel("Mã hạch toán").fill("REV-TA-E2E");
  await page.getByLabel("Nội dung bàn giao").fill(
    "Đã kiểm đếm tiền, vé và giao dịch điện tử; chuyển đủ chứng từ ca.",
  );
  await page.getByRole("button", { name: "Gửi quản lý xác nhận" }).click();
  const submissionStatus = page
    .getByRole("status")
    .filter({ hasText: "đã gửi quản lý xác nhận" });
  await expect(submissionStatus).toBeVisible();
  const submissionMessage = (await submissionStatus.textContent()) ?? "";
  const shiftCode = submissionMessage.match(/SHIFT-[A-Z0-9-]+/)?.[0];
  expect(shiftCode).toBeTruthy();

  await logout(page);
  await login(page, "ql.trangan", "Quanly@2026");
  await page.goto("/erp/trang-an/ve-dat-cho");
  const managerShift = page.locator("details").filter({ hasText: shiftCode! });
  await managerShift.locator("summary").click();
  await managerShift
    .getByPlaceholder("Kết quả kiểm quỹ, POS/QR và chứng từ ca")
    .fill("Đã kiểm quỹ; xác nhận số nguồn và chứng từ ca để kế toán đối soát.");
  await managerShift
    .getByRole("button", { name: "Xác nhận & chuyển kế toán" })
    .click();
  await expect(managerShift).toContainText("Chờ kế toán");

  await logout(page);
  await login(page, "ketoan", "Ketoan@2026");
  await page.goto("/erp/finance");
  const accountingShift = page.locator("details").filter({ hasText: shiftCode! });
  await accountingShift.locator("summary").click();
  await accountingShift
    .getByPlaceholder("Nguồn chênh lệch, chứng từ đã kiểm tra và hướng xử lý")
    .fill("Đã nhận đủ báo cáo POS/QR và biên bản kiểm quỹ để kiểm tra.");
  await accountingShift
    .getByRole("button", { name: "Nhận kiểm tra hồ sơ" })
    .click();
  await expect(accountingShift).toContainText("Kế toán đang kiểm tra");

  const escalateButton = accountingShift.getByRole("button", {
    name: "Chuyển giám đốc quyết định",
  });
  if (!(await escalateButton.isVisible())) {
    await accountingShift.locator("summary").click();
  }
  await accountingShift
    .getByPlaceholder("Nguồn chênh lệch, chứng từ đã kiểm tra và hướng xử lý")
    .fill("Thiếu 18 triệu đồng tại kênh QR; đã đối chiếu sổ quỹ và cần quyết định ngoại lệ.");
  await accountingShift
    .getByRole("button", { name: "Chuyển giám đốc quyết định" })
    .click();
  await expect(accountingShift).toContainText(
    "Đang chờ quyết định ngoại lệ của giám đốc.",
  );

  await logout(page);
  await login(page, "giamdoc", "Giamdoc@2026");
  const directorShift = page.locator("details").filter({ hasText: shiftCode! });
  await directorShift.locator("summary").click();
  await directorShift
    .getByPlaceholder("Phương án xử lý, điều kiện và người chịu trách nhiệm tiếp theo")
    .fill("Duyệt treo khoản chênh lệch và giao kế toán xác minh settlement ngân hàng.");
  await directorShift
    .getByRole("button", { name: "Duyệt phương án ngoại lệ" })
    .click();
  await expect(directorShift).toHaveCount(0);

  await logout(page);
  await login(page, "ketoan", "Ketoan@2026");
  await page.goto("/erp/finance");
  const postingShift = page.locator("details").filter({ hasText: shiftCode! });
  await postingShift.locator("summary").click();
  await postingShift.getByLabel("Số bút toán").fill("JV-E2E-TA-001");
  await postingShift
    .getByPlaceholder("Nguồn chênh lệch, chứng từ đã kiểm tra và hướng xử lý")
    .fill("Đã liên kết quyết định ngoại lệ và chứng từ settlement để ghi sổ.");
  await postingShift
    .getByRole("button", { name: "Đối soát xong & liên kết bút toán" })
    .click();
  await expect(postingShift).toContainText("Đã đối soát");
});

test("manager return goes back to the employee before the same shift can continue", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "The return/resubmit workflow runs once on desktop.",
  );
  test.skip(
    process.env.ERP_PERSISTENCE_MODE === "supabase",
    "Supabase return/resubmit is covered by the four-role exception proof.",
  );
  test.setTimeout(60_000);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 20.25245, longitude: 105.91755 });

  await login(page, "nv.trangan", "Nhanvien@2026");
  await page.goto("/erp/trang-an/cham-cong");
  await page.getByRole("button", { name: "Xác nhận ra ca bằng GPS" }).click();
  await expect(page.getByRole("status")).toContainText("Đã ghi nhận ra ca");
  await page.getByRole("button", { name: "Xác nhận vào ca bằng GPS" }).click();
  await expect(page.getByRole("status")).toContainText("Đã ghi nhận vào ca");

  await page.goto("/erp/trang-an/ve-dat-cho");
  await page.getByLabel("Mã hạch toán").fill("REV-TA-RETURN-E2E");
  await page.getByLabel("Nội dung bàn giao").fill(
    "Bàn giao số vé và tiền thu; bảng kê QR đang chờ bổ sung.",
  );
  await page.getByRole("button", { name: "Gửi quản lý xác nhận" }).click();
  const submissionStatus = page
    .getByRole("status")
    .filter({ hasText: "đã gửi quản lý xác nhận" });
  await expect(submissionStatus).toBeVisible();
  const shiftCode = ((await submissionStatus.textContent()) ?? "").match(
    /SHIFT-[A-Z0-9-]+/,
  )?.[0];
  expect(shiftCode).toBeTruthy();

  await logout(page);
  await login(page, "ql.trangan", "Quanly@2026");
  await page.goto("/erp/trang-an/ve-dat-cho");
  const managerShift = page.locator("details").filter({ hasText: shiftCode! });
  await managerShift.locator("summary").click();
  await managerShift
    .getByPlaceholder("Kết quả kiểm quỹ, POS/QR và chứng từ ca")
    .fill("Thiếu bảng kê giao dịch QR; nhân viên bổ sung trước khi xác nhận.");
  await managerShift
    .getByRole("button", { name: "Trả nhân viên bổ sung" })
    .click();
  await expect(managerShift).toContainText("Quản lý trả lại");

  await logout(page);
  await login(page, "nv.trangan", "Nhanvien@2026");
  await page.goto("/erp/trang-an/ve-dat-cho");
  const employeeShift = page.locator("details").filter({ hasText: shiftCode! });
  await employeeShift.locator("summary").click();
  await expect(employeeShift).toContainText("Thiếu bảng kê giao dịch QR");
  await employeeShift
    .getByPlaceholder("Nêu rõ chứng từ, giải trình hoặc thông tin đã bổ sung")
    .fill("Đã tải bảng kê QR và đối chiếu lại tổng giao dịch điện tử trong ca.");
  await employeeShift.getByRole("button", { name: "Gửi lại quản lý" }).click();
  await expect(employeeShift).toContainText("Chờ quản lý");
  await expect(employeeShift).toContainText("đã bổ sung và gửi lại quản lý xác nhận");

  await logout(page);
  await login(page, "ql.trangan", "Quanly@2026");
  await page.goto("/erp/trang-an/ve-dat-cho");
  const returnedShift = page.locator("details").filter({ hasText: shiftCode! });
  await expect(returnedShift).toContainText("Chờ quản lý");
  await returnedShift.locator("summary").click();
  await expect(
    returnedShift.getByRole("button", { name: "Xác nhận & chuyển kế toán" }),
  ).toBeVisible();
});

test("Supabase shares one ticket shift across employee, manager and accounting contexts", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "The cross-context persistence proof runs once on desktop.",
  );
  test.skip(
    process.env.ERP_PERSISTENCE_MODE !== "supabase",
    "This proof requires the shared Supabase repository.",
  );
  test.setTimeout(90_000);

  const employeeContext = await browser.newContext({
    baseURL,
    geolocation: { latitude: 20.25245, longitude: 105.91755 },
    permissions: ["geolocation"],
  });
  const managerContext = await browser.newContext({ baseURL });
  const accountingContext = await browser.newContext({ baseURL });

  try {
    const employeePage = await employeeContext.newPage();
    await login(employeePage, "nv.trangan", "Nhanvien@2026");
    await employeePage.goto("/erp/trang-an/cham-cong");
    await employeePage.getByRole("button", { name: "Xác nhận ra ca bằng GPS" }).click();
    await expect(employeePage.getByRole("status")).toContainText("Đã ghi nhận ra ca");
    await employeePage.getByRole("button", { name: "Xác nhận vào ca bằng GPS" }).click();
    await expect(employeePage.getByRole("status")).toContainText("Đã ghi nhận vào ca");

    await employeePage.goto("/erp/trang-an/ve-dat-cho");
    await employeePage.getByLabel("Số vé đã bán").fill("462");
    await employeePage.getByLabel("Doanh thu trên hệ thống").fill("79400000");
    await employeePage.getByLabel("Tiền mặt kiểm đếm").fill("32000000");
    await employeePage.getByLabel("Thẻ/QR/chuyển khoản").fill("47400000");
    await employeePage.getByLabel("Tiền hoàn vé").fill("0");
    await employeePage.getByLabel("Mã hạch toán").fill(`REV-TA-MULTI-${Date.now()}`);
    await employeePage.getByLabel("Nội dung bàn giao").fill(
      "Ca cân đủ tiền mặt và giao dịch điện tử; bàn giao chứng từ cho quản lý.",
    );
    await employeePage.getByRole("button", { name: "Gửi quản lý xác nhận" }).click();
    const submissionStatus = employeePage
      .getByRole("status")
      .filter({ hasText: "đã gửi quản lý xác nhận" });
    await expect(submissionStatus).toBeVisible();
    const shiftCode = ((await submissionStatus.textContent()) ?? "").match(
      /SHIFT-[A-Z0-9-]+/,
    )?.[0];
    expect(shiftCode).toBeTruthy();

    const managerPage = await managerContext.newPage();
    await login(managerPage, "ql.trangan", "Quanly@2026");
    await managerPage.goto("/erp/trang-an/ve-dat-cho");
    const managerShift = managerPage.locator("details").filter({ hasText: shiftCode! });
    await managerShift.locator("summary").click();
    await managerShift
      .getByPlaceholder("Kết quả kiểm quỹ, POS/QR và chứng từ ca")
      .fill("Đã kiểm quỹ và xác nhận đủ chứng từ để chuyển kế toán.");
    await managerShift
      .getByRole("button", { name: "Xác nhận & chuyển kế toán" })
      .click();
    await expect(managerShift).toContainText("Chờ kế toán");

    const accountingPage = await accountingContext.newPage();
    await login(accountingPage, "ketoan", "Ketoan@2026");
    await accountingPage.goto("/erp/finance");
    const accountingShift = accountingPage.locator("details").filter({ hasText: shiftCode! });
    await accountingShift.locator("summary").click();
    await accountingShift
      .getByPlaceholder("Nguồn chênh lệch, chứng từ đã kiểm tra và hướng xử lý")
      .fill("Số quỹ và giao dịch điện tử khớp; hồ sơ đủ điều kiện ghi sổ.");
    await accountingShift.getByRole("button", { name: "Nhận kiểm tra hồ sơ" }).click();
    await expect(accountingShift).toContainText("Kế toán đang kiểm tra");
    await accountingShift.getByLabel("Số bút toán").fill(`JV-MULTI-${Date.now()}`);
    await accountingShift
      .getByPlaceholder("Nguồn chênh lệch, chứng từ đã kiểm tra và hướng xử lý")
      .fill("Đã liên kết biên bản ca và xác nhận bút toán cân bằng.");
    await accountingShift
      .getByRole("button", { name: "Đối soát xong & liên kết bút toán" })
      .click();
    await expect(accountingShift).toContainText("Đã đối soát");

    await employeePage.goto("/erp/trang-an/ve-dat-cho");
    const employeeShift = employeePage.locator("details").filter({ hasText: shiftCode! });
    await expect(employeeShift).toContainText("Đã đối soát");
  } finally {
    await Promise.all([
      employeeContext.close(),
      managerContext.close(),
      accountingContext.close(),
    ]);
  }
});

test("Supabase enforces return, stale-version and director exception across four roles", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "The cross-context exception proof runs once on desktop.",
  );
  test.skip(
    process.env.ERP_PERSISTENCE_MODE !== "supabase",
    "This proof requires the shared Supabase repository.",
  );
  test.setTimeout(150_000);

  const employeeContext = await browser.newContext({
    baseURL,
    geolocation: { latitude: 20.25245, longitude: 105.91755 },
    permissions: ["geolocation"],
  });
  const managerContext = await browser.newContext({ baseURL });
  const staleManagerContext = await browser.newContext({ baseURL });
  const accountingContext = await browser.newContext({ baseURL });
  const directorContext = await browser.newContext({ baseURL });

  try {
    const employeePage = await employeeContext.newPage();
    await login(employeePage, "nv.trangan", "Nhanvien@2026");
    await employeePage.goto("/erp/trang-an/cham-cong");
    await employeePage.getByRole("button", { name: "Xác nhận ra ca bằng GPS" }).click();
    await expect(employeePage.getByRole("status")).toContainText("Đã ghi nhận ra ca");
    await employeePage.getByRole("button", { name: "Xác nhận vào ca bằng GPS" }).click();
    await expect(employeePage.getByRole("status")).toContainText("Đã ghi nhận vào ca");

    await employeePage.goto("/erp/trang-an/ve-dat-cho");
    await employeePage.getByLabel("Số vé đã bán").fill("462");
    await employeePage.getByLabel("Doanh thu trên hệ thống").fill("79400000");
    await employeePage.getByLabel("Tiền mặt kiểm đếm").fill("32000000");
    await employeePage.getByLabel("Thẻ/QR/chuyển khoản").fill("29400000");
    await employeePage.getByLabel("Tiền hoàn vé").fill("0");
    await employeePage.getByLabel("Mã hạch toán").fill(`REV-TA-EXCEPTION-${Date.now()}`);
    await employeePage.getByLabel("Nội dung bàn giao").fill(
      "Ca thiếu 18 triệu đồng tại nguồn giao dịch điện tử; đã bàn giao số quỹ và bảng kê hiện có.",
    );
    await employeePage
      .getByRole("button", { name: "Gửi quản lý xác nhận" })
      .dblclick();
    const submissionStatus = employeePage
      .getByRole("status")
      .filter({ hasText: "đã gửi quản lý xác nhận" });
    await expect(submissionStatus).toBeVisible();
    const shiftCode = ((await submissionStatus.textContent()) ?? "").match(
      /SHIFT-[A-Z0-9-]+/,
    )?.[0];
    expect(shiftCode).toBeTruthy();
    await expect(
      employeePage.locator("details").filter({ hasText: shiftCode! }),
    ).toHaveCount(1);

    const managerPage = await managerContext.newPage();
    const staleManagerPage = await staleManagerContext.newPage();
    await login(managerPage, "ql.trangan", "Quanly@2026");
    await login(staleManagerPage, "ql.trangan", "Quanly@2026");
    await managerPage.goto("/erp/trang-an/ve-dat-cho");
    await staleManagerPage.goto("/erp/trang-an/ve-dat-cho");
    const managerShift = managerPage.locator("details").filter({ hasText: shiftCode! });
    const staleManagerShift = staleManagerPage.locator("details").filter({ hasText: shiftCode! });
    await managerShift.locator("summary").click();
    await staleManagerShift.locator("summary").click();

    await managerShift
      .getByPlaceholder("Kết quả kiểm quỹ, POS/QR và chứng từ ca")
      .fill("Thiếu bảng kê settlement QR; trả nhân viên bổ sung chứng từ nguồn.");
    await managerShift
      .getByRole("button", { name: "Trả nhân viên bổ sung" })
      .click();
    await expect(managerShift).toContainText("Quản lý trả lại");

    await staleManagerShift
      .getByPlaceholder("Kết quả kiểm quỹ, POS/QR và chứng từ ca")
      .fill("Phiên cũ thử xác nhận sau khi hồ sơ đã được người khác xử lý.");
    await staleManagerShift
      .getByRole("button", { name: "Xác nhận & chuyển kế toán" })
      .click();
    await expect(staleManagerShift.getByRole("alert")).toContainText(
      "Hồ sơ vừa được người khác cập nhật",
    );

    await employeePage.goto("/erp/trang-an/ve-dat-cho");
    const returnedEmployeeShift = employeePage
      .locator("details")
      .filter({ hasText: shiftCode! });
    await returnedEmployeeShift.locator("summary").click();
    await returnedEmployeeShift
      .getByPlaceholder("Nêu rõ chứng từ, giải trình hoặc thông tin đã bổ sung")
      .fill("Đã bổ sung bảng kê settlement QR và đối chiếu lại tổng tiền theo ca.");
    await returnedEmployeeShift
      .getByRole("button", { name: "Gửi lại quản lý" })
      .click();
    await expect(returnedEmployeeShift).toContainText("Chờ quản lý");

    await managerPage.goto("/erp/trang-an/ve-dat-cho");
    const resubmittedManagerShift = managerPage
      .locator("details")
      .filter({ hasText: shiftCode! });
    await resubmittedManagerShift.locator("summary").click();
    await resubmittedManagerShift
      .getByPlaceholder("Kết quả kiểm quỹ, POS/QR và chứng từ ca")
      .fill("Đã nhận bảng kê bổ sung; xác nhận chênh lệch để kế toán xử lý.");
    await resubmittedManagerShift
      .getByRole("button", { name: "Xác nhận & chuyển kế toán" })
      .click();
    await expect(resubmittedManagerShift).toContainText("Chờ kế toán");

    const accountingPage = await accountingContext.newPage();
    await login(accountingPage, "ketoan", "Ketoan@2026");
    await accountingPage.goto("/erp/finance");
    const accountingShift = accountingPage.locator("details").filter({ hasText: shiftCode! });
    await accountingShift.locator("summary").click();
    await accountingShift
      .getByPlaceholder("Nguồn chênh lệch, chứng từ đã kiểm tra và hướng xử lý")
      .fill("Đã nhận bảng kê bổ sung; tiếp tục xác minh khoản thiếu 18 triệu đồng.");
    await accountingShift.getByRole("button", { name: "Nhận kiểm tra hồ sơ" }).click();
    await expect(accountingShift).toContainText("Kế toán đang kiểm tra");
    await expect(
      accountingShift.getByRole("button", {
        name: "Đối soát xong & liên kết bút toán",
      }),
    ).toHaveCount(0);
    await accountingShift
      .getByPlaceholder("Nguồn chênh lệch, chứng từ đã kiểm tra và hướng xử lý")
      .fill("Settlement QR thiếu 18 triệu đồng; chuyển giám đốc duyệt phương án treo chênh lệch.");
    await accountingShift
      .getByRole("button", { name: "Chuyển giám đốc quyết định" })
      .click();
    await expect(accountingShift).toContainText("Đang chờ quyết định ngoại lệ của giám đốc");

    const directorPage = await directorContext.newPage();
    await login(directorPage, "giamdoc", "Giamdoc@2026");
    const directorShift = directorPage.locator("details").filter({ hasText: shiftCode! });
    await directorShift.locator("summary").click();
    await directorShift
      .getByPlaceholder("Phương án xử lý, điều kiện và người chịu trách nhiệm tiếp theo")
      .fill("Duyệt treo khoản thiếu và giao kế toán xác minh settlement ngân hàng trong ngày.");
    await directorShift
      .getByRole("button", { name: "Duyệt phương án ngoại lệ" })
      .click();
    await expect(directorShift).toHaveCount(0);

    await accountingPage.goto("/erp/finance");
    const approvedAccountingShift = accountingPage
      .locator("details")
      .filter({ hasText: shiftCode! });
    await approvedAccountingShift.locator("summary").click();
    await approvedAccountingShift.getByLabel("Số bút toán").fill(`JV-EXCEPTION-${Date.now()}`);
    await approvedAccountingShift
      .getByPlaceholder("Nguồn chênh lệch, chứng từ đã kiểm tra và hướng xử lý")
      .fill("Đã liên kết quyết định ngoại lệ và hồ sơ settlement để ghi sổ.");
    await approvedAccountingShift
      .getByRole("button", { name: "Đối soát xong & liên kết bút toán" })
      .click();
    await expect(approvedAccountingShift).toContainText("Đã đối soát");

    await employeePage.goto("/erp/trang-an/ve-dat-cho");
    const postedEmployeeShift = employeePage.locator("details").filter({ hasText: shiftCode! });
    await expect(postedEmployeeShift).toContainText("Đã đối soát");
    await postedEmployeeShift.locator("summary").click();
    await expect(postedEmployeeShift.locator("ol li")).toHaveCount(8);
  } finally {
    await Promise.allSettled([
      employeeContext.close(),
      managerContext.close(),
      staleManagerContext.close(),
      accountingContext.close(),
      directorContext.close(),
    ]);
  }
});

test("manager can inspect partner records and create a quotation draft", async ({ page }) => {
  await login(page, "ql.trangan", "Quanly@2026");
  await page.goto("/erp/trang-an/doi-tac-nha-cung-ung");

  const partner = page.locator("details").filter({ hasText: "Công ty Du lịch Hoa Lư" });
  await partner.locator("summary").click();
  await expect(partner).toContainText("ĐKKD.pdf");
  await expect(partner).toContainText("Nhân viên kinh doanh phản hồi trước 11:00");
  await page.locator('select[name="partner"]').selectOption({ label: "Công ty Du lịch Hoa Lư" });
  await page.locator('select[name="product"]').selectOption({ label: "Vé đoàn tiêu chuẩn" });
  await page.getByPlaceholder("Số khách *").fill("42");
  await page.locator('input[name="validUntil"]').fill("2026-12-31");
  await page.getByPlaceholder("Điều khoản thanh toán, hoàn đổi và công nợ *").fill("Công nợ 15 ngày, đổi số lượng trước D-1.");
  await page.getByRole("button", { name: "Tạo báo giá nháp" }).click();
  await expect(page.getByRole("status")).toContainText("Công ty Du lịch Hoa Lư");
});

test("director drills into staff progress, results and revenue evidence", async ({ page }) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/trang-an/nhan-su");

  const performance = page.locator("details").filter({ hasText: "Đối soát đoàn TA-018" });
  await performance.locator("summary").click();
  await expect(performance).toContainText("462 vé · 79,4 triệu");
  await expect(performance).toContainText("4 ảnh · 1 biên bản");
  await expect(performance).toContainText("OPS-TRANG-AN-SHIFT");
});

test("mobile ERP workspaces stay vertical without horizontal overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile workspace audit");
  await login(page, "ql.trangan", "Quanly@2026");

  for (const moduleId of ["bao-cao-hien-truong", "check-in-khach", "doi-tac-nha-cung-ung", "nhan-su"]) {
    await page.goto(`/erp/trang-an/${moduleId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`${moduleId}.png`), fullPage: true });
  }
});

test("ERP login has no serious accessibility violation or horizontal overflow", async ({
  page,
}) => {
  await page.goto("/erp/login");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
