import { expect, test, type Page } from "@playwright/test";

// T11a — production smoke is deliberately read-only. It proves that the
// deployed server can read the new Supabase schema and that each role sees the
// same sourced threshold without leaving operational records behind.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page
    .getByLabel(/Email hoặc tên đăng nhập|Tên đăng nhập/)
    .fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/, { timeout: 25_000 });
}

async function expectCapacityWorkspace(page: Page) {
  await expect(
    page.getByRole("heading", {
      name: "Biết điểm nghẽn trước khi phải dừng luồng",
    }),
  ).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText("nguồn: ước-lượng")).toBeVisible();
  await expect(
    page.getByText(
      "24 phương tiện × 48 chỗ × 60 ÷ 60 phút = 1.152 khách/giờ",
    ),
  ).toBeVisible();
  await expect(page.getByText("Tín hiệu đầu vào hiện tại là proxy:")).toBeVisible();
  await expect(page.getByText("Phản ứng theo bốn mức")).toBeVisible();
}

test("giám đốc đọc được ngưỡng Tam Chúc và thấy quyền chỉnh nguồn", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/tam-chuc/suc-chua");
  await expectCapacityWorkspace(page);
  await expect(page.getByText("Chỉnh giả định và nguồn")).toBeVisible();
  expect(errors, `unexpected runtime errors: ${errors.join(" | ")}`).toEqual([]);
});

test("quản lý và nhân viên chỉ đọc cùng ngưỡng đã lưu", async ({ page }) => {
  for (const account of [
    { username: "ql.tamchuc", password: "Quanly@2026" },
    { username: "nv.bentau", password: "Nhanvien@2026" },
  ]) {
    await login(page, account.username, account.password);
    await page.goto("/erp/tam-chuc/suc-chua");
    await expectCapacityWorkspace(page);
    await expect(page.getByText("Chỉnh giả định và nguồn")).toHaveCount(0);
    await expect(
      page.getByText("Chỉ giám đốc được thay đổi giả định."),
    ).toBeVisible();
    await page.context().clearCookies();
  }
});

test("số tiền KPI kế toán không vỡ đôi cụm chữ số trên mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "ketoan", "Ketoan@2026");

  for (const route of ["/erp", "/erp/finance"]) {
    await page.goto(route);
    const label = page.getByText("Giá trị đã ghi sổ", { exact: true }).first();
    await expect(label).toBeVisible({ timeout: 25_000 });
    const value = label.locator("xpath=following-sibling::p[1]");
    await expect(value).toBeVisible();
    const dimensions = await value.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      whiteSpace: getComputedStyle(element).whiteSpace,
    }));
    expect(dimensions.whiteSpace).toBe("nowrap");
    expect(
      dimensions.scrollWidth,
      `${route} currency KPI overflows at 390px`,
    ).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
