import { expect, test, type Page } from "@playwright/test";
import { loginAsDirector } from "./support/erp-login";
import { endRoleSwitch, switchToAccount } from "./support/erp-role-switch";

// T11a — smoke production cố ý CHỈ ĐỌC màn hình sức chứa: chứng minh máy chủ
// đã triển khai đọc được lược đồ Supabase mới và mỗi vai thấy đúng cùng một
// ngưỡng đã lưu, không để lại bản ghi vận hành nào.
//
// Chỉ đăng nhập MỘT lần, bằng giám đốc, rồi chuyển vai ngay trong phiên —
// đúng cách chủ dự án dùng thật, và cũng là cách để cả bộ smoke chỉ cần một
// mật khẩu. Lý do đầy đủ nằm ở `support/erp-role-switch.ts`.

const TAM_CHUC_FORMULA = "24 phương tiện × 48 chỗ × 60 ÷ 60 phút = 1.152 khách/giờ";
const TRANG_AN_FORMULA = "600 phương tiện × 4 chỗ × 60 ÷ 180 phút = 800 khách/giờ";

async function expectCapacityWorkspace(page: Page, formula: string) {
  await expect(
    page.getByRole("heading", {
      name: "Biết điểm nghẽn trước khi phải dừng luồng",
    }),
  ).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText("nguồn: ước-lượng")).toBeVisible();
  await expect(page.getByText(formula)).toBeVisible();
  await expect(page.getByText("Tín hiệu đầu vào hiện tại là proxy:")).toBeVisible();
  await expect(page.getByText("Phản ứng theo bốn mức")).toBeVisible();
}

test("giám đốc đọc được ngưỡng Tam Chúc và thấy quyền chỉnh nguồn", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await loginAsDirector(page);
  await page.goto("/erp/tam-chuc/suc-chua");
  await expectCapacityWorkspace(page, TAM_CHUC_FORMULA);
  await expect(page.getByText("Chỉnh giả định và nguồn")).toBeVisible();
  expect(errors, `unexpected runtime errors: ${errors.join(" | ")}`).toEqual([]);
});

test("quản lý và nhân viên chỉ đọc cùng ngưỡng đã lưu", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsDirector(page);

  // Chuyển thẳng vai này sang vai kia, không quay về giám đốc ở giữa — chính
  // là bước nhảy T4 cho phép, và cũng là thao tác chủ dự án làm nhiều nhất.
  for (const account of [
    {
      accountId: "manager-tam-chuc",
      bannerName: "Trần Đức Long",
      route: "/erp/tam-chuc/suc-chua",
      formula: TAM_CHUC_FORMULA,
    },
    {
      accountId: "employee-trang-an-02",
      bannerName: "Bùi Quốc Huy",
      route: "/erp/trang-an/suc-chua",
      formula: TRANG_AN_FORMULA,
    },
  ]) {
    await switchToAccount(page, account.accountId, account.bannerName);
    await page.goto(account.route);
    await expectCapacityWorkspace(page, account.formula);
    // Quyền bị thu hẹp thật: ô chỉnh giả định biến mất, và màn hình nói rõ vì sao.
    await expect(page.getByText("Chỉnh giả định và nguồn")).toHaveCount(0);
    await expect(
      page.getByText("Chỉ giám đốc được thay đổi giả định."),
    ).toBeVisible();
  }

  // Không bỏ lại phiên nào đang treo ở vai khác.
  await endRoleSwitch(page);
});

test("số tiền KPI kế toán không vỡ đôi cụm chữ số trên mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsDirector(page);
  await switchToAccount(page, "accountant-001", "Phạm Thu Trang");

  for (const { route, labelText } of [
    { route: "/erp", labelText: "Giá trị đã ghi sổ" },
    { route: "/erp/finance", labelText: "Tổng phát sinh Nợ" },
  ]) {
    await page.goto(route);
    const label = page.getByText(labelText, { exact: true }).first();
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

  await endRoleSwitch(page);
});
