import { expect, test, type Page } from "@playwright/test";

// T15 — nhật ký tập trung, xác minh trên production thật.
//
// Chỉ đọc: không bấm một nút ghi nào, nên không để lại gì. Điều cần chứng minh
// là thứ unit test không chạm tới được — **phạm vi nhìn bị chặn ở máy chủ**.
// Bài quan trọng nhất ở dưới không kiểm "nhân viên thấy ít hơn giám đốc" (điều
// đó giao diện giả được), mà kiểm nhân viên **chỉ thấy đúng tên mình** trong
// mọi dòng, kể cả khi tự sửa địa chỉ web để đòi xem cơ sở khác.

async function login(page: Page, username: string, password: string) {
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

/** Tên người thao tác trên mỗi dòng — link tới hồ sơ của họ. */
function actorNames(page: Page) {
  return page.locator('ol li a[href^="/erp/ho-so/"]');
}

test("giám đốc thấy nhật ký toàn hệ thống, kèm số nhân sự theo khu vực", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/nhat-ky");

  await expect(page.getByRole("heading", { name: "Nhật ký hệ thống" })).toBeVisible();
  await expect(page.getByText("Toàn bộ thao tác trên cả bốn cơ sở.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Số người theo khu vực" })).toBeVisible();

  const names = actorNames(page);
  await expect(names.first()).toBeVisible({ timeout: 20_000 });
  const distinct = new Set(await names.allInnerTexts());
  // Giám đốc phải thấy nhiều người, không phải chỉ mình.
  expect(distinct.size, "giám đốc chỉ thấy một người").toBeGreaterThan(1);

  await page.screenshot({
    path: testInfo.outputPath("prod-t15-director-timeline.png"),
    fullPage: true,
  });
  await logout(page);
});

test("nhân viên chỉ thấy thao tác của chính mình, kể cả khi tự sửa địa chỉ web", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page, "nv.trangan", "Nhanvien@2026");

  // Tự đòi xem một cơ sở khác qua tham số địa chỉ — lọc ở giao diện thì mở được,
  // chặn ở máy chủ thì không.
  await page.goto("/erp/nhat-ky?site=tam-chuc&q=");
  await expect(
    page.getByText("Các thao tác do chính tài khoản này thực hiện."),
  ).toBeVisible();

  await page.goto("/erp/nhat-ky");
  const names = actorNames(page);
  await expect(names.first()).toBeVisible({ timeout: 20_000 });
  const distinct = new Set(await names.allInnerTexts());
  expect(
    distinct.size,
    `nhân viên thấy thao tác của người khác: ${[...distinct].join(", ")}`,
  ).toBe(1);

  await logout(page);
});

test("quản lý thấy việc của người khác trong cơ sở mình, nhưng không thấy toàn hệ thống", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/nhat-ky");
  await expect(actorNames(page).first()).toBeVisible({ timeout: 20_000 });
  const directorRows = await actorNames(page).count();
  await logout(page);

  await page.context().clearCookies();
  await login(page, "ql.vanhanh", "Quanly@2026");
  await page.goto("/erp/nhat-ky");
  await expect(
    page.getByText(/Việc do người của cơ sở bạn làm/),
  ).toBeVisible();
  await expect(actorNames(page).first()).toBeVisible({ timeout: 20_000 });
  const managerRows = await actorNames(page).count();
  const managerDistinct = new Set(await actorNames(page).allInnerTexts());

  // Nhiều hơn một người (thấy được đội của mình và người ngoài tác động lên
  // cơ sở mình), nhưng ít hơn giám đốc.
  expect(managerDistinct.size).toBeGreaterThan(1);
  expect(managerRows).toBeLessThan(directorRows);

  await logout(page);
});

test("tìm theo tên lọc đúng, và bấm vào tên mở hồ sơ người đó", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/nhat-ky");
  await expect(actorNames(page).first()).toBeVisible({ timeout: 20_000 });

  const firstName = (await actorNames(page).first().innerText()).trim();
  await page.getByLabel("Tìm theo tên").fill(firstName);
  await page.getByRole("button", { name: "Lọc" }).click();

  await expect(actorNames(page).first()).toBeVisible({ timeout: 20_000 });
  const filtered = new Set(await actorNames(page).allInnerTexts());
  expect(filtered.size, `lọc theo "${firstName}" vẫn ra nhiều người`).toBe(1);
  expect([...filtered][0].trim()).toBe(firstName);

  // Bấm vào tên là mở hồ sơ — lý do phải có hồ sơ: hai người trùng tên ở hai
  // cơ sở khác nhau phải phân biệt được.
  await actorNames(page).first().click();
  await expect(page).toHaveURL(/\/erp\/ho-so\//, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: new RegExp(`Hoạt động của ${firstName}`) }),
  ).toBeVisible();

  await logout(page);
});
