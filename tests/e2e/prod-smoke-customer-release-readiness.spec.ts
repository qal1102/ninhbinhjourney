import { expect, test } from "@playwright/test";

const enabled = process.env.NBJ_A6_RELEASE_SMOKE === "1";
const expectation = process.env.NBJ_A6_RELEASE_EXPECTATION;

test.describe("A6 production readiness smoke", () => {
  test.skip(!enabled, "Set NBJ_A6_RELEASE_SMOKE=1 and an explicit production expectation to run this read-only smoke.");

  test.beforeAll(() => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
    if (!baseUrl || new URL(baseUrl).hostname !== "ninhbinhjourney.vercel.app") {
      throw new Error("A6 production smoke requires PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app in the same command.");
    }
    if (expectation !== "blocked" && expectation !== "canary-ready") {
      throw new Error("Set NBJ_A6_RELEASE_EXPECTATION=blocked or canary-ready explicitly.");
    }
  });

  test("director reads the real release verdict without mutating production", async ({ page }) => {
    await page.goto("/erp/login");
    await page.getByLabel("Tên đăng nhập").fill("giamdoc");
    await page.getByLabel("Mật khẩu").fill("Giamdoc@2026");
    await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
    await expect(page).toHaveURL(/\/erp$/);
    await page.goto("/erp/release");
    await expect(page.getByRole("heading", { name: "Sẵn sàng phát hành dữ liệu khách hàng" })).toBeVisible({ timeout: 20_000 });

    if (expectation === "canary-ready") {
      await expect(page.getByTestId("release-verdict")).toHaveText("ĐỦ ĐIỀU KIỆN KỸ THUẬT ĐỂ LẬP CANARY");
      await expect(page.getByText("Schema sẵn sàng", { exact: true })).toHaveCount(7);
    } else {
      await expect(page.getByTestId("release-verdict")).toHaveText("CHƯA ĐƯỢC BẬT PRODUCTION");
    }
  });
});
