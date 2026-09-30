import { expect, test } from "@playwright/test";
import { loginAsDirector } from "./support/erp-login";

/**
 * Đại lý & hoa hồng trên production (099), CHỈ ĐỌC. Không bấm "Ghi đã chi"
 * (ghi một dòng chi không xoá được), không thêm đại lý (không có lối xoá),
 * không cấp lại khoá (làm hỏng đường dẫn đại lý đang cầm).
 */

const enabled = process.env.NBJ_DAI_LY_SMOKE === "1";

test.describe("đại lý trên production", () => {
  test.skip(!enabled, "Đặt NBJ_DAI_LY_SMOKE=1 cùng PLAYWRIGHT_BASE_URL production để chạy.");

  test.beforeAll(() => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
    if (!baseUrl || new URL(baseUrl).hostname !== "ninhbinhjourney.vercel.app") {
      throw new Error("Bài này bắt buộc PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app trong CÙNG câu lệnh.");
    }
  });

  test("đường dẫn giới thiệu nhớ mã đại lý, mã lạ thì không", async ({ page, context }) => {
    await page.goto("/dl/HONGHA");
    await expect(page).toHaveURL(/\/packages$/);
    expect((await context.cookies()).find((c) => c.name === "nbj-dai-ly")?.value).toBe("HONGHA");
    await context.clearCookies();
    await page.goto("/dl/KHONGCOMA");
    expect((await context.cookies()).find((c) => c.name === "nbj-dai-ly")).toBeUndefined();
  });

  test("giám đốc thấy bảng hoa hồng tháng trước và xem cổng như đại lý thấy", async ({ page }) => {
    await loginAsDirector(page);
    await page.goto("/erp/dai-ly");
    const thang = page.getByRole("navigation", { name: "Chọn tháng" }).getByRole("link").nth(1);
    await thang.click();
    const the = page.getByTestId("dai-ly-HONGHA");
    await expect(the).toContainText("đại lý mẫu");
    await expect(the).toContainText("Khách đã tới");
    await expect(the.getByRole("button", { name: /Ghi đã chi|Đã chi/ }).or(the.getByText(/^Đã chi /))).toBeVisible();
    await the.getByRole("link", { name: "Xem cổng như đại lý thấy" }).click();
    const cong = page.getByTestId("dai-ly-cong");
    await expect(cong).toContainText("/dl/HONGHA");
    await expect(cong.getByTestId("thang-truoc")).toBeVisible();
    await expect(cong.getByRole("table")).toContainText(/NBJ-[A-Z0-9]{4}•+/);
  });

  test("cổng đại lý sai khoá thì không lộ gì", async ({ page }) => {
    await page.goto("/dai-ly/HONGHA?k=khoasaikhoasaikhoasai");
    await expect(page.getByTestId("dai-ly-khong-mo")).toBeVisible();
    await expect(page.getByText("Hồng Hà")).toHaveCount(0);
  });
});
