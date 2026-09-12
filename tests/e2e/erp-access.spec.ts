import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ERP_ACCOUNTANT_PASSWORD, ERP_DIRECTOR_PASSWORD, ERP_EMPLOYEE_PASSWORD, ERP_MANAGER_PASSWORD, ERP_SEASONAL_PASSWORD } from "./support/erp-credentials";
import { seasonalAccessWindow } from "@/lib/erp/demo-data";

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
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);

  // T13 đã xoá bộ số bịa từng đứng ở đầu màn hình này ("11.450 khách dự kiến ·
  // 1,84 tỷ doanh thu", "Khách dự kiến cả ngày", "Chi phí ghi nhận") cùng với
  // `domain/erp-operating-data.ts`. Các khẳng định cũ ở đây bám vào đúng những
  // con số đó, nên chúng đỏ từ lúc T13 xong — và một bài test đỏ thường trực
  // thì không chặn được hồi quy nào cả. Thay bằng thứ màn hình thật sự hiển
  // thị, và **kèm khẳng định ngược** để số bịa không lẳng lặng quay lại.
  await expect(page.getByRole("heading", { name: /hồ sơ đang chờ/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ca bán vé, công việc và sổ kế toán" }),
  ).toBeVisible();
  await expect(page.getByText(/khách dự kiến · .* tỷ doanh thu/)).toHaveCount(0);
  await expect(page.getByText("Khách dự kiến cả ngày", { exact: true })).toHaveCount(0);
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

test("bảng tài chính hợp nhất bịa số đã bị gỡ, không quay lại", async ({ page }, testInfo) => {
  // Bài này trước đây kiểm màn hình "Tài chính hợp nhất" so sánh kỳ với
  // 38,6 tỷ doanh thu và 13,6 tỷ lợi nhuận — toàn bộ là số hằng trong mã
  // nguồn, và T13 đã xoá cả `executive-finance-overview.tsx` lẫn
  // `finance-dashboard.tsx`. Chủ thể của bài test không còn tồn tại, nên giữ
  // nguyên là để một bài đỏ vĩnh viễn. Đổi thành hàng rào cho chính T13.
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await expect(page.getByRole("heading", { name: "Tài chính hợp nhất" })).toHaveCount(0);
  await expect(page.getByText("38,6 tỷ")).toHaveCount(0);
  await expect(page.getByText("13,6 tỷ")).toHaveCount(0);

  await page.goto("/erp/finance");
  // Số ở đây phải đến từ hồ sơ thật (ca đã chốt, hoá đơn đã ghi sổ). Không
  // khẳng định một con số cụ thể — dữ liệu thật thì thay đổi.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("finance-overview.png"), fullPage: true });
});

test("director opens an AI camera view and cannot turn a simulated number into an incident", async ({ page }) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/tam-chuc/camera-ai");

  await expect(page.getByRole("heading", { level: 1, name: "Camera AI & hiện trường" })).toBeVisible();
  await expect(page.getByText("Camera theo khu vực")).toBeVisible();
  await page.getByRole("button", { name: /CAM 02/ }).click();
  await expect(page.getByRole("dialog", { name: /Camera Bến thuyền/ })).toBeVisible();

  // T17: nút "Giao quản lý kiểm tra" từng gửi `feed.people` (số mô phỏng) vào
  // `reportIncidentFromCameraAction` và tạo một sự cố thật mang số liệu giả.
  // Nút đã gỡ; bài test giữ cho nó không quay lại, và kiểm màn hình tự khai
  // báo là mô hình chứ không phải số đo.
  await expect(page.getByRole("button", { name: "Giao quản lý kiểm tra" })).toHaveCount(0);
  await expect(page.getByText("Đây là mô hình, không phải số đo")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("director can track an event project with budget, deadline and urgent work", async ({ page }) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/trang-an/du-an-su-kien");
  await expect(page.getByRole("heading", { level: 1, name: "Dự án & sự kiện" })).toBeVisible();
  await expect(page.getByText("Lễ hội Tràng An 2026")).toBeVisible();
  await expect(page.getByText("12,8 tỷ")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gói việc" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Yêu cầu đổi ngân sách / hạn / phạm vi" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("employee is blocked from another site and can check attendance by GPS", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 20.25245, longitude: 105.91755 });
  await login(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);

  // Khoanh trong `main`: menu di động dựng bằng portal và ẩn trên desktop, mà
  // link đầu tiên theo thứ tự DOM lại nằm trong đó — `.first()` toàn trang bắt
  // trúng một phần tử ẩn rồi báo "không nhìn thấy".
  await expect(page.locator('main a[href^="/erp/trang-an/"]').first()).toBeVisible();
  await expect(page.locator('main a[href^="/erp/tam-chuc/"]')).toHaveCount(0);

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
  await login(page, "ketoan", ERP_ACCOUNTANT_PASSWORD);

  await expect(page.getByText("Bàn làm việc kế toán", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Phạm Thu Trang" })).toBeVisible();
  await expect(page.locator("main a[href=\"/erp/finance\"]").first()).toBeVisible();
  await expect(page.getByText("Ca của tôi", { exact: true })).toHaveCount(0);

  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Mở menu" }).click();
    await expect(page.getByRole("link", { name: /Đối soát & lập bút toán/ })).toBeVisible();
    await page.getByRole("link", { name: /Đối soát & lập bút toán/ }).click();
  } else {
    await page.goto("/erp/finance");
  }

  await expect(page.getByRole("heading", { level: 1, name: "Đối soát & lập bút toán" })).toBeVisible();
  const payableCase = page
    .locator("details")
    .filter({ hasText: "AP-TC-202607-018" });
  await payableCase.locator("summary").click();
  await expect(payableCase).toContainText("PO-TC-2026-018");
  await expect(payableCase).toContainText("NT-TC-2026-018");
  await expect(payableCase).toContainText("Nợ 6277");
  await payableCase
    .getByRole("button", { name: "Lập công nợ và gửi kiểm tra" })
    .click();
  await expect(payableCase).toContainText("Chờ kế toán trưởng");
  await expect(payableCase).toContainText("Nợ 220.000.000");
  await expect(payableCase).toContainText("Có 220.000.000");

  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.getByRole("heading", { level: 1, name: "Vé & đặt chỗ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi quản lý xác nhận" })).toHaveCount(0);

  await page.goto("/erp/trang-an/doi-tac-nha-cung-ung");
  await expect(
    page.getByRole("button", { name: "Gửi hồ sơ và chạy đối chiếu" }),
  ).toHaveCount(0);
  const sourceException = page
    .locator("details")
    .filter({ hasText: "AP-TA-202607-024" });
  await sourceException.locator("summary").click();
  await expect(
    sourceException.getByRole("button", { name: "Gửi lại cho kế toán" }),
  ).toHaveCount(0);

  await page.goto("/erp/trang-an/bao-cao-hien-truong");
  await expect(page.getByRole("button", { name: "Gửi báo cáo" })).toHaveCount(0);

  await page.goto("/erp/tam-chuc/camera-ai");
  await expect(page).toHaveURL(/\/erp\/tam-chuc\?denied=module/);
  await page.goto("/erp/trang-an/nhan-su");
  await expect(page).toHaveURL(/\/erp\/trang-an\?denied=module/);

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("seasonal employee gets expiring trained-only access and manager can see the boundary", async ({ page }) => {
  await login(page, "tv.trangan", ERP_SEASONAL_PASSWORD);
  await expect(page.getByText("Nhân viên thời vụ · Tràng An", { exact: true })).toBeVisible();
  // Không chép cứng ngày. Trước đây bài này khẳng định "31/08/2026", đúng mốc
  // tài khoản thời vụ hết hạn — nên từ 01/09/2026 nó đỏ vì lý do lịch chứ
  // không vì sản phẩm (ERP-SMOKE-02). Cửa sổ quyền nay tự trượt, và bài đọc
  // ngày từ chính nguồn sinh ra nó.
  const hanQuyen = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(seasonalAccessWindow().accessEndsAt));
  await expect(
    page.getByText(`Quyền làm việc có hiệu lực đến ${hanQuyen}`),
  ).toBeVisible();
  await expect(page.getByText("08:00–12:00", { exact: true })).toBeVisible();
  await expect(page.locator('a[href="/erp/trang-an/check-in-khach"]').first()).toBeVisible();
  await expect(page.locator('a[href="/erp/trang-an/ve-dat-cho"]')).toHaveCount(0);
  await expect(page.locator('a[href="/erp/trang-an/camera-ai"]')).toHaveCount(0);
  await page.goto("/erp/tam-chuc");
  await expect(page).toHaveURL(/\/erp\?denied=site/);

  await logout(page);
  await login(page, "ql.trangan", ERP_MANAGER_PASSWORD);
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
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Mở menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu điều hành" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tài chính toàn vùng/ })).toBeVisible();
  await page.getByRole("link", { name: /Tài chính toàn vùng/ }).click();
  await expect(page).toHaveURL(/\/erp\/finance$/);

  // Ba khẳng định cũ ở đây ("Doanh thu & hiệu quả", "Chi phí đã ghi nhận",
  // "Phải trả đến hạn") bám vào bảng điều khiển tài chính mà T13 đã xoá cùng
  // `finance-dashboard.tsx`. Chuỗi đó không còn ở bất kỳ đâu trong mã nguồn,
  // nên bài này đỏ vĩnh viễn vì chủ thể không còn — không phải vì sản phẩm
  // hỏng. Màn hình `/erp/finance` bây giờ là `AccountingControlCenter`, và
  // giám đốc thấy bốn khối: thẻ số đã ghi sổ, công nợ nhà cung cấp, đối soát
  // tiền mặt, sổ nhật ký. Khẳng định lại theo đúng bốn khối ấy — gỡ khối nào
  // đi cũng phải đỏ.
  await expect(page.getByRole("heading", { level: 1, name: "Tài chính đã ghi nhận" })).toBeVisible();
  await expect(page.getByText("Tài chính & báo cáo · toàn vùng", { exact: true })).toBeVisible();
  await expect(page.getByText("Tổng phát sinh Nợ", { exact: true })).toBeVisible();
  await expect(page.getByText("Bút toán đảo", { exact: true })).toBeVisible();
  // Trợ lý điều hành trỏ thẳng vào `/erp/finance#supplier-payables`, nên cái
  // neo ấy là hợp đồng giữa hai màn hình chứ không phải chi tiết trình bày.
  await expect(page.locator("#supplier-payables")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Công nợ từ PO và nghiệm thu" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nộp quỹ → ngân hàng → đối chiếu sao kê" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sổ nhật ký kế toán" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Mở trợ lý điều hành" }).click();
  await expect(page.getByRole("dialog", { name: "Bạn cần mở màn hình nào?" })).toBeVisible();
  const command = page.getByPlaceholder("Ví dụ: Mở tài chính tổng hợp");
  const assistantThread = page.getByTestId("assistant-thread");
  await command.fill("Hôm nay doanh thu bao nhiêu?");
  // "1,84 tỷ đồng" là số hằng T13 đã gỡ. Câu hỏi doanh thu bây giờ đi qua
  // `/api/erp/assistant`, cộng từ hồ sơ chốt ca trong phạm vi tài khoản. Nên
  // khẳng định đúng tính chất ấy: có một lượt gọi API trả 200, và câu trả lời
  // là số tiền đọc được từ hồ sơ. Ai thay bằng số hằng thì câu trả lời hết
  // dạng tiền tệ hoặc lượt gọi biến mất, hai đằng đều đỏ.
  const revenueResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/erp/assistant") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Gửi lệnh" }).click();
  expect((await revenueResponse).status()).toBe(200);
  await expect(assistantThread).toContainText(/₫ doanh thu thuần/);
  await expect(page.getByText("1,84 tỷ đồng")).toHaveCount(0);

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
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
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
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);

  // Bản mock cũ dựng theo cách trợ lý làm việc hồi 29/07, khi mã sản phẩm chỉ
  // đọc `event.results[0][0].transcript`. Ngày 02/08 (T17) trợ lý bật
  // `interimResults` và từ đó phân biệt kết quả tạm với kết quả cuối bằng cờ
  // `isFinal` — đúng như Web Speech API thật quy định. Mock cũ không có cờ ấy,
  // nên `isFinal` là `undefined`: câu nói rơi hết vào nhánh "chữ đang hiện
  // dần", `execute` không bao giờ chạy và trang đứng yên ở `/erp`. Đây là lỗi
  // của bài kiểm, không phải của sản phẩm.
  //
  // Mock mới bám sát API thật và **để bài kiểm tự bấm nhịp**: nói dở câu
  // (`isFinal: false`) rồi mới nói trọn câu (`isFinal: true`), nhờ vậy kiểm
  // được cả phần chữ hiện dần lẫn phần điều hướng.
  await page.evaluate(() => {
    class MockRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onresult:
        | ((event: {
            resultIndex: number;
            results: Array<{ 0: { transcript: string }; isFinal: boolean }>;
          }) => void)
        | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        this.onstart?.();
        (window as unknown as { nbjSpeechDriver: unknown }).nbjSpeechDriver = {
          say: (transcript: string, isFinal: boolean) =>
            this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript }, isFinal }] }),
          finish: () => this.onend?.(),
        };
      }
      stop() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { value: MockRecognition, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: MockRecognition, configurable: true });
  });
  await page.getByRole("button", { name: "Mở trợ lý điều hành" }).click();
  await page.getByRole("button", { name: /Nói để mở nhanh/ }).click();

  type SpeechDriver = { say: (transcript: string, isFinal: boolean) => void; finish: () => void };

  await page.evaluate(() => {
    (window as unknown as { nbjSpeechDriver: SpeechDriver }).nbjSpeechDriver.say("mở dự án", false);
  });
  const assistantThread = page.getByTestId("assistant-thread");
  await expect(assistantThread).toContainText("Đang chuyển thành văn bản");
  await expect(assistantThread).toContainText("mở dự án");
  await expect(page).toHaveURL(/\/erp$/);

  await page.evaluate(() => {
    const speech = (window as unknown as { nbjSpeechDriver: SpeechDriver }).nbjSpeechDriver;
    speech.say("Mở dự án lễ hội Tràng An", true);
    speech.finish();
  });
  await expect(page).toHaveURL(/\/erp\/trang-an\/du-an-su-kien$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dự án & sự kiện" })).toBeVisible();

  // Câu vừa nói phải còn nguyên trong luồng hội thoại sau khi chuyển trang —
  // đó là điều T17 hứa và là lý do luồng được giữ trong `sessionStorage`.
  await page.getByRole("button", { name: "Mở trợ lý điều hành" }).click();
  await expect(assistantThread).toContainText("Tin nhắn thoại");
  await expect(assistantThread).toContainText("Mở dự án lễ hội Tràng An");
  await expect(assistantThread).toContainText("Đã mở Dự án & sự kiện · Tràng An");
});

test("manager grants a module and the employee receives it on the next login", async ({
  page,
}, testInfo) => {
  await login(page, "ql.trangan", ERP_MANAGER_PASSWORD);
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
  await login(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.getByRole("heading", { level: 1, name: "Vé & đặt chỗ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gửi chốt vé và tiền thu" })).toBeVisible();
});

test("employee submits an image-backed field report with accounting trace", async ({ page }) => {
  await login(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
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
  await login(page, "ql.trangan", ERP_MANAGER_PASSWORD);
  await page.goto("/erp/trang-an/check-in-khach");
  // Bài này trước đây khẳng định gõ `QR-TEST-2026-001` là "Đã ghi nhận" — tức
  // là khẳng định đúng cái lỗi T8 đã vá: gõ mã bất kỳ cũng ghi nhận một khách.
  // Để nguyên thì nguy hiểm hơn là đỏ: ai đó "sửa cho xanh" là mất luôn tính
  // chất bảo mật. Đảo lại thành hàng rào cho T8.
  await page.getByPlaceholder("Đưa mã vào máy quét hoặc nhập mã QR").fill("QR-TEST-2026-001");
  await page.getByRole("button", { name: "Xác thực & ghi nhận" }).click();
  await expect(page.locator('[role="status"], [role="alert"]').first()).not.toContainText(
    "Đã ghi nhận QR-TEST-2026-001",
  );

  // "+15,3% so với bình quân năm 2023–2025" là một chuỗi hằng trong mã nguồn,
  // đã đi cùng bộ số bịa T13 xoá. Không có ba năm dữ liệu thật nào để so sánh,
  // nên khẳng định đúng điều đó thay vì chờ nó quay lại.
  await expect(page.getByText(/so với bình quân năm 2023–2025/)).toHaveCount(0);

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

  await login(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
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
  await login(page, "ql.trangan", ERP_MANAGER_PASSWORD);
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
  await login(page, "ketoan", ERP_ACCOUNTANT_PASSWORD);
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
  // Chuyển cấp xong thì hồ sơ **rời khỏi hàng việc của kế toán** — không còn
  // nằm đó với một dòng trạng thái như bài test cũ chờ đợi. Đây mới là hành vi
  // đúng: một hồ sơ đang chờ người khác quyết định mà vẫn nằm trong hàng của
  // mình thì hàng việc mất hết ý nghĩa. Bước giám đốc ngay dưới chứng minh nó
  // đã sang đúng chỗ, chứ không phải biến mất.
  await expect(accountingShift).toHaveCount(0);

  await logout(page);
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
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
  await login(page, "ketoan", ERP_ACCOUNTANT_PASSWORD);
  await page.goto("/erp/finance");
  // Giám đốc duyệt xong thì ca quay lại kế toán ở "Hàng lập bút toán". Bài test
  // cũ tìm một `details` với ô "Số bút toán" và nút "Đối soát xong & liên kết
  // bút toán" — màn hình lập bút toán đã được dựng lại thành thẻ `article` với
  // luồng maker/checker (T10), nên khẳng định cũ đỏ dù nghiệp vụ chạy đúng.
  const postingShift = page.locator("article").filter({ hasText: shiftCode! });
  await expect(postingShift).toBeVisible();
  await postingShift
    .getByLabel("Ghi chú kiểm tra nguồn")
    .fill("Đã liên kết quyết định ngoại lệ và chứng từ settlement để ghi sổ.");
  await postingShift
    .getByRole("button", { name: "Lập bút toán và gửi kiểm tra" })
    .click();
  // Gửi đi rồi thì rời hàng của kế toán lập, sang kế toán trưởng kiểm tra —
  // đúng nguyên tắc người lập ≠ người duyệt.
  await expect(postingShift).toHaveCount(0);
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

  await login(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
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
  await login(page, "ql.trangan", ERP_MANAGER_PASSWORD);
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
  await login(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
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
  await login(page, "ql.trangan", ERP_MANAGER_PASSWORD);
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
    await login(employeePage, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
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
    await login(managerPage, "ql.trangan", ERP_MANAGER_PASSWORD);
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
    await login(accountingPage, "ketoan", ERP_ACCOUNTANT_PASSWORD);
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
    await login(employeePage, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
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
    await login(managerPage, "ql.trangan", ERP_MANAGER_PASSWORD);
    await login(staleManagerPage, "ql.trangan", ERP_MANAGER_PASSWORD);
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
    await login(accountingPage, "ketoan", ERP_ACCOUNTANT_PASSWORD);
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
    await login(directorPage, "giamdoc", ERP_DIRECTOR_PASSWORD);
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

test("manager completes source evidence before an invoice reaches accounting", async ({
  page,
}) => {
  await login(page, "ql.trangan", ERP_MANAGER_PASSWORD);
  await page.goto("/erp/trang-an/doi-tac-nha-cung-ung");

  await expect(
    page.getByRole("heading", { level: 1, name: "Đối tác & nhà cung ứng" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "PO, nghiệm thu, hóa đơn và công nợ",
    }),
  ).toBeVisible();

  const invoice = page
    .locator("details")
    .filter({ hasText: "AP-TA-202607-024" });
  await invoice.locator("summary").click();
  await expect(invoice).toContainText("Cần bổ sung nguồn");
  await expect(invoice).toContainText("Thiếu biên bản nhận hàng/nghiệm thu");
  await invoice
    .getByLabel("Mã biên bản nghiệm thu")
    .fill("NT-TA-2026-024");
  await invoice.getByLabel("Giá trị nghiệm thu (đ)").fill("118800000");
  await invoice.getByRole("button", { name: "Gửi lại cho kế toán" }).click();

  await expect(invoice).toContainText("Sẵn sàng hạch toán");
  await expect(invoice).toContainText("NT-TA-2026-024");
  await expect(
    invoice.getByRole("button", { name: "Gửi lại cho kế toán" }),
  ).toHaveCount(0);
});

// ERP-UX-09: bài này từng khẳng định "462 vé · 79,4 triệu", "4 ảnh · 1 biên
// bản" và "OPS-TRANG-AN-SHIFT" trong một khối `details`. Cả ba chuỗi nay
// không còn ở đâu trong mã nguồn — và chúng biến mất KHÔNG phải do ai lỡ tay:
// đó đúng là những con số bịa mà ERP-FAKE-01 đã cố ý bóc đi, vì không có
// nguồn dữ liệu nào sinh ra chúng. Bài kiểm cũ vì thế đang canh giữ một tính
// năng đã bị gỡ có chủ đích, và một bài kiểm đỏ thường trực thì không chặn
// được hồi quy nào.
//
// Bài mới canh đúng cái quyết định ấy: màn hình chỉ được nói những gì nó thật
// sự đọc được, và phải nói thẳng phần nó chưa có.
test("director reads real staff presence and the screen admits what it has no data for", async ({
  page,
}) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/trang-an/nhan-su");

  const shiftSection = page.locator("section").filter({
    hasText: "Đọc từ phân công tài khoản và lượt chấm công hôm nay",
  });
  await expect(
    shiftSection.getByRole("heading", { name: "Ca làm tại Tràng An" }),
  ).toBeVisible();

  // Bốn ô đếm phải cộng khớp nhau. Đây là khẳng định có sức nặng: ai nhét một
  // con số dựng sẵn vào bất kỳ ô nào cũng làm vỡ đẳng thức này, trong khi một
  // khẳng định "ô này bằng 7" thì chỉ khoá cứng dữ liệu mẫu hôm nay.
  const readCard = async (label: string) => {
    const value = await shiftSection
      .locator("article")
      .filter({ hasText: label })
      .locator("p")
      .nth(1)
      .innerText();
    return Number.parseInt(value, 10);
  };
  const assigned = await readCard("Được phân công");
  const onShift = await readCard("Đang trong ca");
  const finished = await readCard("Đã tan ca");
  const notStarted = await readCard("Chưa vào ca");
  expect(assigned).toBeGreaterThan(0);
  expect(onShift + finished + notStarted).toBe(assigned);

  // Danh sách phải đúng bằng số người được phân công — không nhiều hơn (nhân
  // sự mẫu lấp chỗ trống), không ít hơn (ai đó bị rơi khỏi danh sách).
  const people = shiftSection.getByRole("listitem");
  await expect(people).toHaveCount(assigned);

  // "Drills into" — phần còn giữ nguyên tinh thần của bài cũ: giám đốc bấm
  // vào một người và tới được đúng hồ sơ người ấy.
  const firstPerson = people.first().getByRole("link").first();
  const name = (await firstPerson.innerText()).trim();
  const href = await firstPerson.getAttribute("href");
  expect(href).toMatch(/^\/erp\/ho-so\/[a-z0-9-]+$/);
  await firstPerson.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);

  // Lời tự khai phải còn nguyên. Gỡ nó đi mà không có nguồn dữ liệu thật thì
  // màn hình lại im lặng về chỗ nó không biết — đúng thứ ERP-FAKE-01 đã sửa.
  await page.goBack();
  await expect(shiftSection).toContainText(
    "chưa có nguồn dữ liệu, nên chưa hiển thị ở đây",
  );

  // Ba con số bịa cũ không được quay lại bằng bất cứ đường nào.
  await expect(page.getByText("462 vé · 79,4 triệu")).toHaveCount(0);
  await expect(page.getByText("OPS-TRANG-AN-SHIFT")).toHaveCount(0);
  await expect(page.getByText("4 ảnh · 1 biên bản")).toHaveCount(0);
});

test("mobile ERP workspaces stay vertical without horizontal overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile workspace audit");
  await login(page, "ql.trangan", ERP_MANAGER_PASSWORD);

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

/*
 * Bốn bài dưới đây sinh ra từ một buổi "đi bấm tay" bằng tài khoản giám đốc
 * ngày 09/09/2026, không phải từ một yêu cầu tính năng. Chủ dự án chỉ dùng
 * tài khoản giám đốc, nên chỗ nào giám đốc không bấm tới được thì coi như
 * không tồn tại — và cả bốn chỗ dưới đây đều đã từng như vậy.
 */

test("việc chính của giám đốc dẫn tới đúng chỗ quyết định được", async ({ page }) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);

  // Nút "việc cần làm trước tiên" từng trỏ sang `/erp/finance`. Hàng chốt ca
  // ở trang ấy bọc trong `user.role === "accountant"`, nên giám đốc bấm xong
  // sang một trang KHÔNG BAO GIỜ chứa hồ sơ mình phải duyệt. Nay nút đưa
  // thẳng xuống khối quyết định nằm cùng trang.
  const nextAction = page.getByRole("link", { name: /Xuống hồ sơ chốt ca/ });
  await expect(nextAction).toBeVisible();
  await expect(nextAction).toHaveAttribute("href", "#quyet-dinh-giam-doc");
  await nextAction.click();
  const decisionSection = page.locator("#quyet-dinh-giam-doc");
  await expect(decisionSection).toBeVisible();
  await expect(decisionSection).toContainText("Cần giám đốc quyết định");

  // Và hồ sơ ấy thật sự nằm trong khối này chứ không phải ở sổ kế toán.
  const shiftRow = decisionSection.locator("details").first();
  await expect(shiftRow).toBeVisible();
  const shiftCode = (await shiftRow.locator("summary").innerText()).match(
    /SC-[A-Z]+-\d{8}-\d+/,
  );
  expect(shiftCode).not.toBeNull();
  await page.goto("/erp/finance");
  await expect(page.getByText(shiftCode![0])).toHaveCount(0);
});

test("hàng chốt ca chờ giám đốc nói rõ là bấm mở được", async ({ page }) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);

  // `summary` ở đây dùng `list-none`, tức không còn tam giác mặc định. Không
  // có chữ gợi ý thì hai nút quyết định nằm khuất bên trong và giám đốc chỉ
  // thấy một dòng trạng thái đứng yên — đúng cái bẫy "màn hình im lặng".
  const shiftRow = page
    .locator("#quyet-dinh-giam-doc details")
    .first();
  const summary = shiftRow.locator("summary");
  await expect(summary).toContainText("Mở để quyết định");
  await expect(
    shiftRow.getByRole("button", { name: "Duyệt phương án ngoại lệ" }),
  ).toBeHidden();

  await summary.click();
  await expect(summary).toContainText("Thu gọn");
  await expect(
    shiftRow.getByRole("button", { name: "Duyệt phương án ngoại lệ" }),
  ).toBeVisible();
  await expect(
    shiftRow.getByRole("button", { name: "Trả kế toán làm rõ" }),
  ).toBeVisible();
});

test("hàng chốt ca rỗng nói vì sao rỗng và chỉ chỗ đi tiếp", async ({ page }) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/trang-an/ve-dat-cho");

  // Trước đây chỗ này chỉ có đúng một câu "Không có ca nào trong hàng đợi
  // hiện tại." treo giữa trang: không tiêu đề, không lý do, không lối đi.
  const queue = page.getByRole("region", { name: "Quy trình chốt ca vé" });
  await expect(queue).toContainText("Hàng chốt ca của bạn");
  await expect(queue).toContainText("Không có ca nào chờ bạn xử lý");
  await expect(queue).toContainText("chỉ hiện hồ sơ đang chờ chính tài khoản của bạn");
  const wayOut = queue.getByRole("link", { name: /Mở đối soát cuối ca/ });
  await expect(wayOut).toBeVisible();
  await wayOut.click();
  await expect(page).toHaveURL(/\/erp\/trang-an\/tai-chinh-doi-soat$/);
});

test("báo cáo hiện trường thiếu ảnh không mượn ảnh quảng bá của cơ sở", async ({ page }) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/trang-an/bao-cao-hien-truong");

  // Ô đếm nói thẳng là ba báo cáo thiếu bằng chứng, nhưng thẻ vẫn lấy
  // `site.image` — ảnh quảng bá Tràng An — làm nền. Ba tấm ảnh đẹp đứng ngay
  // dưới con số nói không có ảnh nào: một trong hai đang nói dối.
  await expect(page.getByText("Thiếu ảnh hiện trường")).toBeVisible();
  const card = page.locator("main button").filter({ hasText: "IMG-0842" });
  await expect(card).toContainText("Chưa đính kèm ảnh hiện trường");
  const backgrounds = await card
    .locator("div")
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundImage),
    );
  expect(backgrounds.some((value) => value.includes("trang-an"))).toBe(false);

  await card.click();
  const dialog = page.getByRole("dialog", { name: /Báo cáo IMG-0842/ });
  await expect(dialog).toContainText("chưa đính kèm ảnh hiện trường");
});

test("giám đốc dùng điện thoại vẫn mở được tài khoản và hồ sơ của mình", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile drawer check");
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);

  // Trên máy tính hai lối này nằm ở thanh đầu trang, nhưng cả hai đều `hidden`
  // dưới `lg` và ngăn kéo không chép chúng sang. Mở ERP bằng điện thoại là
  // `/erp/tai-khoan` và `/erp/ho-so/...` biến mất khỏi sản phẩm.
  await page.getByRole("button", { name: "Mở menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Menu điều hành" });
  await drawer.getByRole("link", { name: /^Tài khoản/ }).click();
  await expect(page).toHaveURL(/\/erp\/tai-khoan$/);
  await expect(page.getByRole("heading", { name: "Tài khoản & phân quyền" })).toBeVisible();

  await page.goto("/erp");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await drawer.getByRole("link", { name: /Nguyễn Minh Anh/ }).click();
  await expect(page).toHaveURL(/\/erp\/ho-so\/director-001$/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});

/**
 * Lượt đi tiếp theo cùng con đường, 10/09/2026.
 *
 * Lượt trước dừng giữa chừng ở hàng chốt ca. Lượt này đi hết: đăng nhập giám
 * đốc rồi mở từng màn hình bấm tới được, cả máy tính lẫn điện thoại. Năm bài
 * dưới đây canh đúng năm chỗ đã bắt được — không có bài nào viết cho một chỗ
 * chưa từng hỏng.
 */

/**
 * Mã việc trong sổ thi công, tên hạ tầng và đường dẫn thô đều là chữ của
 * người dựng hệ thống, không phải chữ của người dùng hệ thống. Giám đốc mở
 * màn hình để điều hành, không phải để đọc số hiệu công việc của chúng ta.
 */
const CHU_KY_THUAT_NOI_BO =
  /\bERP\b|\bPII\b|\bT\d{1,2}[ab]?\b|\bCUS-\d+\b|\bA\d ·|migration|Supabase|server secret|\bRPC\b|\bRLS\b|\/erp\/|Customer 360|\bpayment\b|\boutbound\b|\bprofile\b|\bconsent\b|\bstaged\b|\bprovider\b|\bproxy\b/i;

/**
 * Đúng những màn hình giám đốc bấm tới được từ `/erp`.
 *
 * `/erp/khach-hang` từng cố ý vắng mặt vì còn câu "hãy kiểm tra migration và
 * cấu hình máy chủ". Ngày 13/09/2026 cả màn hình đã viết lại bằng tiếng Việt
 * (bỏ "Customer 360", tên bảng `customer_journeys`, "payment", "outbound",
 * "vé T8"), nên nay nó vào danh sách canh như mọi màn hình khác.
 */
const MAN_HINH_GIAM_DOC = [
  "/erp",
  "/erp/finance",
  "/erp/khach-hang",
  "/erp/marketing",
  "/erp/nhat-ky",
  "/erp/tai-khoan",
  "/erp/ho-so/director-001",
  "/erp/trang-an",
  "/erp/trang-an/ve-dat-cho",
  "/erp/trang-an/check-in-khach",
  "/erp/trang-an/suc-chua",
  "/erp/trang-an/su-co",
  "/erp/trang-an/sop-dien-tap",
  "/erp/trang-an/tai-chinh-doi-soat",
  "/erp/trang-an/nhan-su",
  "/erp/trang-an/cham-cong",
];

test("màn hình điều hành không để lọt chữ kỹ thuật nội bộ", async ({ page }) => {
  test.slow();
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);

  for (const path of MAN_HINH_GIAM_DOC) {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    // Chờ khung chờ RỜI KHỎI trang trước khi đọc chữ. `app/loading.tsx` cũng
    // dựng một thẻ <main> mang `aria-busy`, nên có một nhịp hai thẻ cùng nằm
    // trong trang và `getByRole("main")` khớp trúng khung chờ — đọc chữ của
    // khung chờ thì bài kiểm này chẳng canh được gì.
    await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);
    const noiDung = page.getByRole("main");
    await expect(noiDung).toBeVisible();
    expect(
      await noiDung.innerText(),
      `${path} để lọt chữ kỹ thuật nội bộ ra màn hình điều hành`,
    ).not.toMatch(CHU_KY_THUAT_NOI_BO);
  }
});

test("màn hình tài chính cơ sở gọi trạng thái ca bằng tiếng Việt", async ({ page }) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/trang-an/tai-chinh-doi-soat");

  // Khối "Nguồn doanh thu" từng in thẳng giá trị lưu trong kho, nên giám đốc
  // mở màn hình tài chính của cơ sở là đọc được chữ `submitted` giữa một
  // trang tiếng Việt — trong khi cùng hồ sơ ấy, hàng chốt ca gọi là
  // "Chờ quản lý".
  const hang = page.locator("details").filter({ hasText: "SC-TA-20260728-01" }).first();
  const tomTat = hang.locator("summary");
  await expect(tomTat).toContainText("Chờ quản lý");
  await expect(tomTat).not.toContainText("submitted");

  // `list-none` đã bỏ mất tam giác mở, nên hàng phải tự nói ra là bấm được.
  await expect(tomTat).toContainText("Xem hồ sơ");
  await expect(hang.getByText("Người gửi")).toBeHidden();
  await tomTat.click();
  await expect(tomTat).toContainText("Thu gọn");
  await expect(hang.getByText("Người gửi")).toBeVisible();
});

test("hàng sự cố chuyển cấp nói rõ là bấm mở được", async ({ page }) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/trang-an/su-co");

  // Cùng một cái bẫy với hàng chốt ca: `details` bỏ tam giác mở. Giám đốc chỉ
  // thấy một dòng đứng yên kèm đồng hồ đếm ngược, còn lý do chuyển cấp và
  // người đang phụ trách thì nằm khuất bên trong.
  const hoSo = page.locator("details").filter({ hasText: "INC-TA-071" }).first();
  const tomTat = hoSo.locator("summary");
  await expect(tomTat).toContainText("Mở hồ sơ");
  await expect(hoSo.getByText("Người phụ trách")).toBeHidden();

  await tomTat.click();
  await expect(tomTat).toContainText("Thu gọn");
  await expect(hoSo.getByText("Người phụ trách")).toBeVisible();
  await expect(hoSo.getByText("Việc tiếp theo")).toBeVisible();
});

test("màn hình sức chứa chưa đọc được vẫn có một việc bấm được", async ({ page }) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/trang-an/suc-chua");

  // Bản chạy cục bộ không nối kho thật nên màn hình này rỗng — đúng dịp để
  // canh chính cái khối rỗng ấy. Nó từng khép lại bằng "Hãy kiểm tra kết nối
  // kho ERP rồi tải lại trang": vừa là chữ nội bộ, vừa giao cho giám đốc một
  // việc không phải của họ, mà lại chẳng có nút nào để tải lại.
  const khoiRong = page.getByText("Chưa thể đọc ngưỡng sức chứa");
  await expect(khoiRong).toBeVisible();
  await expect(page.getByRole("main")).toContainText("xin báo bộ phận kỹ thuật");

  const loiDiTiep = page.getByRole("link", { name: "Tải lại màn hình sức chứa" });
  await expect(loiDiTiep).toBeVisible();
  await loiDiTiep.click();
  await expect(page).toHaveURL(/\/erp\/trang-an\/suc-chua$/);
});

test("hồ sơ nhân sự chỉ đường bằng liên kết, không bằng chuỗi đường dẫn", async ({
  page,
}) => {
  await login(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await page.goto("/erp/ho-so/director-001");

  // Hai câu ở màn hình này từng in ra `/erp/tai-khoan` như một chuỗi mã: chỉ
  // đúng nơi cần đến rồi bỏ mặc người đọc tự gõ lại đường dẫn. Một ngõ cụt
  // ngay giữa màn hình quản trị.
  const noiDung = page.getByRole("main");
  await expect(noiDung).not.toContainText("/erp/tai-khoan");

  const sangPhanQuyen = noiDung
    .getByRole("link", { name: "Tài khoản & phân quyền" })
    .first();
  await expect(sangPhanQuyen).toBeVisible();
  await sangPhanQuyen.click();
  await expect(page).toHaveURL(/\/erp\/tai-khoan$/);
});
