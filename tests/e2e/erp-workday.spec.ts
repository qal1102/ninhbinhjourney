import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/erp$/);
}

async function managerRecord(page: Page) {
  return page
    .locator("article")
    .filter({ hasText: "Bùi Quốc Huy" })
    .filter({ hasText: "Điều phối hàng chờ" })
    .last();
}

test("employee workday runs across separate employee and manager sessions with GPS, photo and approval", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(
    process.env.ERP_PERSISTENCE_MODE !== "supabase",
    "Cross-session lifecycle requires the shared Supabase repository.",
  );
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The persistent fixture runs once; mobile layout is covered by the ERP mobile suite.",
  );

  const managerContext = await browser.newContext();
  const employeeContext: BrowserContext = await browser.newContext({
    geolocation: { latitude: 20.25245, longitude: 105.91755 },
    permissions: ["geolocation"],
  });
  const managerPage = await managerContext.newPage();
  const employeePage = await employeeContext.newPage();

  try {
    await login(managerPage, "ql.trangan", "Quanly@2026");
    const existingRecord = await managerRecord(managerPage);
    if (
      (await existingRecord.count()) > 0 &&
      (await existingRecord
        .locator("span")
        .filter({ hasText: "Đã hoàn thành" })
        .count()) > 0
    ) {
      await existingRecord.getByRole("button", { name: "Xem vị trí" }).click();
      await expect(
        managerPage.getByRole("dialog", { name: /Vị trí của Bùi Quốc Huy/ }),
      ).toBeVisible();
      await managerPage
        .getByRole("button", { name: "Đóng bản đồ" })
        .click();
      await login(employeePage, "nv.bentau", "Nhanvien@2026");
      await expect(
        employeePage.getByText(/Đã được Lê Hoàng Nam xác nhận/),
      ).toBeVisible();
      return;
    }

    const assignment = managerPage
      .locator("form")
      .filter({ hasText: "Nhân viên" })
      .filter({ hasText: "Công việc đúng với cơ sở" });
    await assignment
      .locator('select[name="employeeId"]')
      .selectOption("employee-trang-an-02");
    await assignment
      .locator('select[name="templateId"]')
      .selectOption("ta-wharf-flow");
    await assignment.locator('input[name="dueTime"]').fill("23:55");
    await assignment
      .locator('input[name="managerNote"]')
      .fill("Báo ngay nếu thời gian chờ vượt 15 phút.");
    await assignment.getByRole("button", { name: "Giao việc" }).click();
    await expect(managerPage.getByRole("status")).toContainText("Đã giao");

    await login(employeePage, "nv.bentau", "Nhanvien@2026");
    await expect(
      employeePage.getByRole("heading", {
        name: "Điều phối hàng chờ và phân thuyền",
      }),
    ).toBeVisible();
    await employeePage
      .getByRole("button", { name: "Cho phép GPS và vào ca" })
      .click();
    await expect(employeePage.getByRole("status")).toContainText("Đã vào ca");
    await expect(employeePage.getByText("GPS trong ca đang bật")).toBeVisible();

    const progressForm = employeePage
      .locator("form")
      .filter({ hasText: "Cập nhật trong ca" });
    await progressForm.locator('select[name="progressPercent"]').selectOption("50");
    await progressForm
      .locator('textarea[name="note"]')
      .fill("Đã phân luồng lượt đầu, thời gian chờ hiện dưới 10 phút.");
    await progressForm.getByRole("button", { name: "Lưu cập nhật" }).click();
    await expect(employeePage.getByRole("status")).toContainText(
      "Đã cập nhật tiến độ 50%",
    );

    const handoverForm = employeePage
      .locator("form")
      .filter({ hasText: "Bàn giao cuối ca" });
    await handoverForm
      .locator('textarea[name="note"]')
      .fill("Đã phân thuyền đủ lượt, không còn khách chờ tại khu vực phụ trách.");
    await handoverForm.locator('input[name="evidence"]').setInputFiles({
      name: "ban-giao-ben-thuyen.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await handoverForm
      .getByRole("button", { name: "Bàn giao và kết thúc ca" })
      .click();
    await expect(employeePage.getByRole("status")).toContainText("Đã bàn giao");
    await expect(
      employeePage.getByText(/Đã bàn giao lúc/),
    ).toBeVisible();

    await managerPage.reload();
    const record = await managerRecord(managerPage);
    await expect(record).toContainText("Chờ quản lý duyệt");
    await expect(record).toContainText("GPS");
    await record.getByRole("button", { name: "Xem vị trí" }).click();
    await expect(
      managerPage.getByRole("dialog", { name: /Vị trí của Bùi Quốc Huy/ }),
    ).toBeVisible();
    await managerPage
      .getByRole("button", { name: "Đóng bản đồ" })
      .click();

    const reviewForm = record.locator("form");
    await reviewForm
      .locator('input[name="note"]')
      .fill("Đã kiểm tra ảnh và nhật ký vị trí, kết quả đạt.");
    await reviewForm
      .getByRole("button", { name: "Xác nhận hoàn thành" })
      .click();
    await expect(managerPage.getByRole("status")).toContainText(
      "Đã xác nhận công việc hoàn thành",
    );

    await employeePage.reload();
    await expect(
      employeePage
        .locator("span")
        .filter({ hasText: "Đã hoàn thành" })
        .last(),
    ).toBeVisible();
    await expect(employeePage.getByText(/Đã được Lê Hoàng Nam xác nhận/)).toBeVisible();
  } finally {
    await managerContext.close();
    await employeeContext.close();
  }
});

test("employee workday fits a phone viewport without horizontal scrolling", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "This assertion targets the phone layout.",
  );
  await login(page, "nv.trangan", "Nhanvien@2026");
  await expect(
    page.getByRole("list", { name: "Tiến trình công việc" }),
  ).toBeVisible();
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport + 1);
});
