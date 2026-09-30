import { expect, test } from "@playwright/test";

/**
 * Đổi ngôn ngữ trên web khách (30/09/2026). Trước đó chỉ trang chủ, Hợp tác
 * và Sự kiện theo mùa theo tiếng Anh; bấm EN rồi sang Khám phá, Gói, trang
 * điểm đến hay đặt vé là về lại tiếng Việt. Chỉ đọc, không ghi gì.
 */

test("EN theo khách từ Khám phá sang Gói và trang điểm đến, giữ nguyên source", async ({ page }) => {
  await page.goto("/explore?source=trang_an");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Chọn cách đi trước");

  await page.getByRole("group", { name: "Ngôn ngữ" }).getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Choose how you travel");
  expect(page.url()).toContain("source=trang_an");
  expect(page.url()).toContain("lang=en");
  // Máy chủ dựng `lang` ngay trên <main>, không đổi <html> sau khi trang hiện.
  await expect(page.locator("main")).toHaveAttribute("lang", "en");

  // Cookie nhớ lựa chọn: trang sau không cần tham số vẫn là tiếng Anh.
  await page.goto("/packages");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Five ways through Ninh Binh");
  await page.goto("/destination/trang-an");
  await expect(page.getByRole("heading", { name: "The story of this place" })).toBeVisible();
  await page.goto("/destination/cuc-phuong");
  await expect(page.getByRole("heading", { name: "How to visit" })).toBeVisible();

  // Tải lại vẫn giữ; bấm VI là về tiếng Việt ngay.
  await page.reload();
  await expect(page.getByRole("heading", { name: "How to visit" })).toBeVisible();
  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "VI" }).click();
  await expect(page.getByRole("heading", { name: "Đi thế nào" })).toBeVisible();
});

test("trang đặt vé và tra cứu vé có bản tiếng Anh", async ({ page }) => {
  await page.goto("/checkout?package=heritage-day&lang=en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A seat held");
  await expect(page.getByText("Pick a day. We hold your seats for 15 minutes.")).toBeVisible();
  await page.goto("/tra-cuu-ve?lang=en");
  await expect(page.getByRole("heading", { name: "Open a ticket you booked" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open my tickets" })).toBeVisible();
});

test("trang điểm đến không còn in mã sở thích thô", async ({ page }) => {
  await page.goto("/destination/trang-an?lang=vi");
  await expect(page.getByText("Di sản", { exact: true })).toBeVisible();
  await expect(page.getByText("heritage", { exact: true })).toHaveCount(0);
});

test("Bàn Trăng hết mùa thì không mời giữ chỗ nữa", async ({ page }) => {
  await page.goto("/packages?lang=vi");
  const ban = page.locator("#goi-ban-trang-tam-coc-2026");
  await expect(ban.getByTestId("goi-het-mua")).toBeVisible();
  await expect(ban.getByRole("link", { name: "Chọn gói" })).toHaveCount(0);
  await page.goto("/checkout?package=ban-trang-tam-coc-2026&lang=vi");
  await expect(page.getByTestId("goi-het-mua")).toContainText("Mùa này đã khép");
});
