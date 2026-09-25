import { expect, test } from "@playwright/test";

/**
 * Hồ sơ hợp tác lật trang (món B1).
 *
 * Hồ sơ vẫn đọc theo cuộn dọc; bài này canh phần "lật": nút trang trước/sau,
 * phím mũi tên khi con trỏ đang ở trong hồ sơ, và số trang báo cho trình đọc
 * màn hình. Phím mũi tên KHÔNG được bị cướp khi con trỏ ở ngoài hồ sơ.
 */
test.describe("Hồ sơ hợp tác lật trang", () => {
  test("bấm nút thì sang trang sau, số trang đổi theo", async ({ page }) => {
    await page.goto("/collaborations?lang=vi");
    const hoSo = page.locator("[data-collaboration-dossier]");
    await expect(hoSo).toHaveAttribute("data-dossier-active", "celine");
    const truoc = page.getByRole("button", { name: "Trang trước" });
    await expect(truoc).toBeDisabled();

    await page.getByRole("button", { name: "Trang sau" }).click();
    await expect(hoSo).toHaveAttribute("data-dossier-active", "chanel");
    await expect(page.locator("[data-lat-trang] [aria-live]")).toHaveText("Trang 2/5");
    await expect(truoc).toBeEnabled();
  });

  test("phím mũi tên lật trang khi con trỏ ở trong hồ sơ", async ({ page }) => {
    await page.goto("/collaborations?lang=vi");
    const hoSo = page.locator("[data-collaboration-dossier]");
    await page.getByRole("button", { name: "Trang sau" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(hoSo).toHaveAttribute("data-dossier-active", "chanel");
    await page.keyboard.press("ArrowLeft");
    await expect(hoSo).toHaveAttribute("data-dossier-active", "celine");
  });

  test("chữ không bao giờ xoay theo trang giấy", async ({ page }) => {
    await page.goto("/collaborations?lang=vi");
    await page.locator("#dossier-prada").scrollIntoViewIfNeeded();
    const xoay = await page
      .locator("#dossier-prada [data-dossier-copy]")
      .evaluate((el) => getComputedStyle(el).transform);
    // Phần chữ chỉ được trượt dọc (ma trận 2D), không có thành phần xoay 3D.
    expect(xoay.startsWith("matrix3d")).toBe(false);
  });
});
