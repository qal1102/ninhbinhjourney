import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/*
 * Lượt kiểm tay ngày 12/09/2026: sáu điểm đến không có trang riêng,
 * `/robots.txt` và `/sitemap.xml` đều 404, dán đường dẫn lên Zalo không ra ảnh.
 * Bài này mở thật từng trang mới trên trình duyệt.
 */

const SAU_DIEM_MOI = [
  { slug: "cuc-phuong", ten: "Cúc Phương" },
  { slug: "phat-diem", ten: "Nhà thờ Phát Diệm" },
  { slug: "am-tien", ten: "Động Am Tiên" },
  { slug: "bich-dong", ten: "Chùa Bích Động" },
  { slug: "thai-vi", ten: "Đền Thái Vi" },
  { slug: "bear-sanctuary", ten: "Cơ sở bảo tồn gấu Ninh Bình" },
];

const CHU_KY_THUAT = /\bdemo\b|information|undefined|null|NaN/i;

for (const { slug, ten } of SAU_DIEM_MOI) {
  test(`trang riêng ${slug} mở được, đúng tên, có ảnh chia sẻ`, async ({ page }) => {
    const res = await page.goto(`/destination/${slug}`, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: ten })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Câu chuyện của điểm đến" })).toBeVisible();

    const noiDung = await page.getByRole("main").innerText();
    expect(noiDung, `${slug} để lọt chữ kỹ thuật`).not.toMatch(CHU_KY_THUAT);

    const anhChiaSe = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(anhChiaSe).toMatch(new RegExp(`^https://.+/images/og/destination-${slug}\\.jpg$`));
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toMatch(new RegExp(`/destination/${slug}$`));

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(1);
  });
}

test("trang riêng mới không có lỗi truy cập nghiêm trọng", async ({ page }) => {
  await page.goto("/destination/phat-diem", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const ketQua = await new AxeBuilder({ page }).analyze();
  const nang = ketQua.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(nang.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test("trang hồ sơ sâu không còn chữ tiếng Anh 'Demo information'", async ({ page }) => {
  await page.goto("/destination/trang-an", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Tràng An" })).toBeVisible();
  await expect(page.getByText(/Demo information/i)).toHaveCount(0);
});

test("robots.txt và sitemap.xml trả về nội dung thật", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const chuRobots = await robots.text();
  expect(chuRobots).toContain("Disallow: /erp");
  expect(chuRobots).toMatch(/Sitemap: https:\/\/.+\/sitemap\.xml/);

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const chuSitemap = await sitemap.text();
  for (const { slug } of SAU_DIEM_MOI) expect(chuSitemap).toContain(`/destination/${slug}</loc>`);
  expect(chuSitemap).not.toContain("/erp");
});

test("trang điểm đến có cổng mời đặt gói có chặng ở đó; Hoa Lư thì không", async ({ page }) => {
  await page.goto("/destination/tam-chuc", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);
  const khoi = page.getByTestId("goi-co-noi-nay");
  await expect(khoi.getByRole("heading", { name: "Đặt vé nơi này" })).toBeVisible();
  const goi = khoi.getByRole("link", { name: /Tam Chúc: chùa trên hồ/ });
  await expect(goi).toHaveAttribute("href", /^\/packages\/tam-chuc-chua-tren-ho/);
  await goi.click();
  await expect(page).toHaveURL(/\/packages\/tam-chuc-chua-tren-ho/);
  await expect(page.getByRole("heading", { level: 1, name: "Tam Chúc: chùa trên hồ" })).toBeVisible();

  // Gói hết mùa (Bàn Trăng) không được mời ở Tam Cốc nữa.
  await page.goto("/destination/tam-coc-bich-dong", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("goi-co-noi-nay").getByRole("link", { name: /Cinematic/ })).toBeVisible();
  await expect(page.getByTestId("goi-co-noi-nay").getByRole("link", { name: /Bàn Trăng/ })).toHaveCount(0);

  await page.goto("/destination/hoa-lu-ancient-capital", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("goi-co-noi-nay")).toHaveCount(0);
});
