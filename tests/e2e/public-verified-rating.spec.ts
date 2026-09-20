import { expect, test } from "@playwright/test";

/**
 * TC-12 — bảng điểm "người đã tới đây nói gì" trên trang điểm đến.
 *
 * Bài chặn `/api/site-reviews` lại và tự trả lời, nên không đọc gì từ cơ sở
 * dữ liệu thật. Nó canh đúng chỗ đã sập một lần trong lúc dựng: trang đọc
 * đúng dạng dữ liệu mà API trả về. Lần ấy trang không báo lỗi gì cả — khối
 * bảng điểm chỉ lặng lẽ biến mất, và chỉ mắt người mới thấy.
 */

const TRANG_AN = "10000000-0000-4000-8000-000000000001";

function bangDiem(count: number) {
  return {
    accepted: true,
    summaries: [
      {
        siteId: TRANG_AN,
        count,
        average: 4.58,
        spread: { "1": 0, "2": 1, "3": 1, "4": 2, "5": 8 },
        recentVoices: [
          { rating: 5, comment: "Đi chuyến sớm nhất thì thuyền vắng.", createdAt: "2026-09-19T01:00:00Z" },
        ],
      },
    ],
  };
}

test.describe("TC-12: bảng điểm trên trang điểm đến", () => {
  test("đủ ba người trở lên thì hiện điểm số và lời kể", async ({ page }) => {
    await page.route("**/api/site-reviews**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bangDiem(12)) }),
    );
    await page.goto("/destination/trang-an", { waitUntil: "domcontentloaded" });
    const khoi = page.getByTestId("verified-rating-panel");
    await expect(khoi).toBeVisible({ timeout: 15000 });
    await expect(khoi).toContainText("4,6/5");
    await expect(khoi).toContainText("12 người đã tới đây chấm");
    await expect(khoi).toContainText("Đi chuyến sớm nhất thì thuyền vắng.");
  });

  test("dưới ba người thì nói thật là chưa đủ, không dựng thành điểm", async ({ page }) => {
    await page.route("**/api/site-reviews**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bangDiem(2)) }),
    );
    await page.goto("/destination/trang-an", { waitUntil: "domcontentloaded" });
    const khoi = page.getByTestId("verified-rating-panel");
    await expect(khoi).toBeVisible({ timeout: 15000 });
    await expect(khoi).toContainText("chưa đủ để dựng thành điểm số");
    await expect(khoi).not.toContainText("/5 ·");
  });

  test("chưa ai kể thì khối biến mất hẳn, không để lại khung rỗng", async ({ page }) => {
    await page.route("**/api/site-reviews**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accepted: true, summaries: [] }),
      }),
    );
    await page.goto("/destination/trang-an", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("verified-rating-panel")).toHaveCount(0);
  });

  test("kho chưa sẵn sàng thì trang điểm đến vẫn nguyên vẹn", async ({ page }) => {
    await page.route("**/api/site-reviews**", (route) => route.fulfill({ status: 503, body: "" }));
    await page.goto("/destination/trang-an", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Câu chuyện của điểm đến" })).toBeVisible();
    await expect(page.getByTestId("verified-rating-panel")).toHaveCount(0);
  });
});
