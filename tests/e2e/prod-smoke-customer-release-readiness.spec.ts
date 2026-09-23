import { expect, test } from "@playwright/test";
import { loginAsDirector } from "./support/erp-login";

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
    await loginAsDirector(page);
    await page.goto("/erp/release");
    await expect(page.getByRole("heading", { name: "Sẵn sàng phát hành dữ liệu khách hàng" })).toBeVisible({ timeout: 20_000 });

    if (expectation === "canary-ready") {
      await expect(page.getByTestId("release-verdict")).toHaveText("ĐỦ ĐIỀU KIỆN ĐỂ MỞ THỬ");
      await expect(page.getByText("Kho dữ liệu sẵn sàng", { exact: true })).toHaveCount(7);
    } else {
      await expect(page.getByTestId("release-verdict")).toHaveText("CHƯA BẬT CHO KHÁCH THẬT");
    }
  });
});
